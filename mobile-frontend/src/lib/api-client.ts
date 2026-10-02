import { useAuthStore } from "@/store/auth-store";
import { env } from "./env";
import { tokenStorage } from "./secure-store";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function rawRequest(
  path: string,
  init: RequestInit,
  accessToken: string | null,
) {
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  const data = text ? safeParseJson(text) : undefined;
  return { res, data };
}

let refreshPromise: Promise<string | null> | null = null;

// Nhiều request cùng lúc bị 401 (vd list + detail fetch song song) chỉ nên gọi
// /auth/refresh đúng 1 lần — gộp lại dùng chung 1 Promise thay vì refresh N lần.
function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) return null;
      try {
        const { res, data } = await rawRequest(
          "/auth/refresh",
          { method: "POST", body: JSON.stringify({ refreshToken }) },
          null,
        );
        if (!res.ok) return null;
        const tokens = data as { accessToken: string; refreshToken: string };
        await tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
        useAuthStore.getState().setAccessToken(tokens.accessToken);
        return tokens.accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Các route tự nó đã trả 401 vì lý do nghiệp vụ (sai mật khẩu, refresh token hết hạn...)
// — không được đem thử refresh lại, sẽ gây vòng lặp hoặc che mất lỗi thật.
const NO_REFRESH_RETRY_PATHS = new Set([
  "/auth/login",
  "/auth/refresh",
  "/auth/google",
]);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  let { res, data } = await rawRequest(path, init, accessToken);

  if (res.status === 401 && !NO_REFRESH_RETRY_PATHS.has(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      ({ res, data } = await rawRequest(path, init, newToken));
    } else {
      await tokenStorage.clear();
      useAuthStore.getState().clear();
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
