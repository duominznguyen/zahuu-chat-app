import { useAuthStore, type AuthUser } from "@/store/auth-store";
import { apiClient } from "./api-client";
import { clearSession } from "./clear-session";
import { signInWithGoogle } from "./google-auth";
import { refreshSession, startRefreshTimer } from "./token-refresh";

interface SessionResponse {
  user: AuthUser;
  reactivated?: boolean;
}

function applySession(res: SessionResponse) {
  useAuthStore.getState().setSession(res.user);
  startRefreshTimer();
  return res;
}

// Gọi 1 lần lúc app khởi động: cookie accessToken/refreshToken (nếu có) tự gửi
// kèm, không có bước "đọc token cũ" nào như mobile vì không có gì để đọc phía
// client. Luôn kết thúc bằng setReady() dù thành công hay thất bại, để App biết
// lúc nào hết loading.
//
// PHẢI gọi qua refreshSession() (có khoá Web Locks + dedupe-trong-tab), KHÔNG
// gọi thẳng apiClient.post('/auth/refresh') — bug thật đã gặp: React StrictMode
// (dev mode) tự double-invoke effect nên bootstrapAuth() chạy 2 lần gần như
// đồng thời lúc mount; gọi refresh trực tiếp khiến 2 request cùng mang 1
// refresh token CŨ, backend rotate ở request đầu rồi coi request sau là token
// bị tái sử dụng → revoke TOÀN BỘ token, kể cả token vừa cấp ở request đầu —
// user bị tự đăng xuất ngay sau khi vừa đăng nhập thành công mỗi lần reload
// trang. refreshSession() vốn dựng ra chính để chặn đúng kiểu race này (ban
// đầu nhắm tới multi-tab, nhưng áp dụng được y hệt cho double-invoke trong 1 tab).
export async function bootstrapAuth() {
  try {
    const refreshed = await refreshSession();
    if (!refreshed) throw new Error("refresh failed");
    const user = await apiClient.get<AuthUser>("/users/me");
    applySession({ user });
  } catch {
    clearSession();
  } finally {
    useAuthStore.getState().setReady();
  }
}

export async function login(email: string, password: string) {
  const res = await apiClient.post<SessionResponse>("/auth/login", { email, password });
  return applySession(res);
}

export async function loginWithGoogle() {
  const idToken = await signInWithGoogle();
  const res = await apiClient.post<SessionResponse>("/auth/google", { idToken });
  return applySession(res);
}

export async function register(email: string, displayName: string, password: string) {
  return apiClient.post<{ message: string; resendAfterSeconds: number }>("/auth/register", {
    email,
    displayName,
    password,
  });
}

export async function resendOtp(email: string) {
  return apiClient.post<{ message: string; resendAfterSeconds: number }>("/auth/resend-otp", {
    email,
  });
}

export async function verifyEmail(email: string, otp: string) {
  const res = await apiClient.post<SessionResponse>("/auth/verify-email", { email, otp });
  return applySession(res);
}

export async function forgotPassword(email: string) {
  return apiClient.post<{ message: string }>("/auth/forgot-password", { email });
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  return apiClient.post<{ message: string }>("/auth/reset-password", {
    email,
    otp,
    newPassword,
  });
}

export async function logout() {
  try {
    await apiClient.post("/auth/logout");
  } catch {
    // Vẫn đăng xuất phía client dù gọi API lỗi (vd mất mạng) — không để người
    // dùng bị kẹt không thoát được tài khoản chỉ vì request logout thất bại.
  }
  clearSession();
}
