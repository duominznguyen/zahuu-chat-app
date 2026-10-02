import { useAuthStore, type AuthUser } from "@/store/auth-store";
import { apiClient } from "./api-client";
import { tokenStorage } from "./secure-store";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse extends TokenPair {
  user: AuthUser;
  reactivated: boolean;
}

async function persistSession(tokens: TokenPair, user: AuthUser) {
  await tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
  useAuthStore.getState().setSession(tokens.accessToken, user);
}

// Gọi 1 lần lúc app khởi động: có refresh token cũ thì đổi lấy access token mới
// rồi fetch lại thông tin user (/auth/refresh không trả kèm user). Luôn kết thúc
// bằng setReady() dù thành công hay thất bại, để RootLayout biết lúc nào hết loading.
export async function bootstrapAuth() {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) {
    useAuthStore.getState().setReady();
    return;
  }

  try {
    const tokens = await apiClient.post<TokenPair>("/auth/refresh", {
      refreshToken,
    });
    useAuthStore.getState().setAccessToken(tokens.accessToken);
    const user = await apiClient.get<AuthUser>("/users/me");
    await persistSession(tokens, user);
  } catch {
    await tokenStorage.clear();
    useAuthStore.getState().clear();
  } finally {
    useAuthStore.getState().setReady();
  }
}

export async function login(email: string, password: string) {
  const res = await apiClient.post<AuthResponse>("/auth/login", {
    email,
    password,
  });
  await persistSession(res, res.user);
  return res;
}

export async function register(
  email: string,
  displayName: string,
  password: string,
) {
  return apiClient.post<{ message: string; resendAfterSeconds: number }>(
    "/auth/register",
    {
      email,
      displayName,
      password,
    },
  );
}

export async function resendOtp(email: string) {
  return apiClient.post<{ message: string; resendAfterSeconds: number }>(
    "/auth/resend-otp",
    {
      email,
    },
  );
}

export async function verifyEmail(email: string, otp: string) {
  const res = await apiClient.post<Omit<AuthResponse, "reactivated">>(
    "/auth/verify-email",
    {
      email,
      otp,
    },
  );
  await persistSession(res, res.user);
  return res;
}

export async function forgotPassword(email: string) {
  return apiClient.post<{ message: string }>("/auth/forgot-password", {
    email,
  });
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
) {
  return apiClient.post<{ message: string }>("/auth/reset-password", {
    email,
    otp,
    newPassword,
  });
}

export async function logout() {
  const refreshToken = await tokenStorage.getRefreshToken();
  try {
    if (refreshToken) {
      await apiClient.post("/auth/logout", { refreshToken });
    }
  } catch {
    // Vẫn đăng xuất phía client dù gọi API lỗi (vd mất mạng) — không để người
    // dùng bị kẹt không thoát được tài khoản chỉ vì request logout thất bại.
  }
  await tokenStorage.clear();
  useAuthStore.getState().clear();
}
