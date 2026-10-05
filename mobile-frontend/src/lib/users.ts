import { useAuthStore } from "@/store/auth-store";
import { apiClient } from "./api-client";
import { clearSession } from "./clear-session";
import { tokenStorage } from "./secure-store";

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type AuthProviderType = "LOCAL" | "GOOGLE";

export interface MeProfile {
  id: string;
  username: string;
  usernameChangeAvailableAt: string | null;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  birthday: string | null;
  gender: Gender | null;
  createdAt: string;
  hasPassword: boolean;
  providers: AuthProviderType[];
}

export function getMe() {
  return apiClient.get<MeProfile>("/users/me");
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string | null;
  birthday?: string | null;
  gender?: Gender | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
}

export function updateProfile(data: UpdateProfileInput) {
  return apiClient.patch<MeProfile>("/users/me", data);
}

export function changeUsername(username: string) {
  return apiClient.patch<MeProfile>("/users/me/username", { username });
}

export async function changePassword(oldPassword: string, newPassword: string) {
  // Backend revoke hết refresh token khác rồi cấp cặp mới cho thiết bị hiện
  // tại — phải tự cập nhật session ngay, không thì request tiếp theo bị 401
  // vì access token cũ (tuy chưa hết hạn) không còn khớp refresh token mới.
  const tokens = await apiClient.patch<{
    accessToken: string;
    refreshToken: string;
  }>("/users/me/password", { oldPassword, newPassword });
  await tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
  useAuthStore.getState().setAccessToken(tokens.accessToken);
}

export async function deactivateAccount(password?: string) {
  await apiClient.delete<void>("/users/me", password ? { password } : {});
  await clearSession();
}
