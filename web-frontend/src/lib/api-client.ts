import { env } from "./env";

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

// TODO (W3): bắt 401 → gọi POST /auth/refresh (1 Promise dùng chung cho nhiều
// request 401 cùng lúc, khoá cross-tab qua Web Locks API) → retry request gốc
// đúng 1 lần, xem docs/web-frontend-docs/web-frontend-plan.md mục 5.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
