import { clearSession } from "./clear-session";
import { env } from "./env";
import { refreshSession } from "./token-refresh";

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function rawRequest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    credentials: "include", // cookie accessToken/refreshToken tự gửi kèm, không tự gắn header Authorization
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const text = await res.text();
  const data = text ? safeParseJson(text) : undefined;
  return { res, data };
}

// 401 ở các route này là lỗi nghiệp vụ thật (sai mật khẩu, refresh token hết
// hạn...), không phải access token hết hạn — thử refresh lại sẽ gây vòng lặp
// hoặc che mất lỗi thật.
const NO_REFRESH_RETRY_PATHS = new Set(["/auth/login", "/auth/refresh", "/auth/google"]);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let { res, data } = await rawRequest(path, init);

  if (res.status === 401 && !NO_REFRESH_RETRY_PATHS.has(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      ({ res, data } = await rawRequest(path, init));
    } else {
      clearSession();
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
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
};
