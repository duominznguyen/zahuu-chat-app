import { useQuery } from "@tanstack/react-query";
import { useAuthStore, type AuthUser } from "@/store/auth-store";
import { ApiError, apiClient } from "./api-client";
import { clearSession } from "./clear-session";

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

export function useMe() {
  return useQuery({ queryKey: ["users", "me"], queryFn: getMe });
}

// Giữ thông tin hiện ở Rail (tên, avatar, username) đồng bộ sau khi đổi hồ sơ.
export function syncAuthUser(me: MeProfile) {
  const user: AuthUser = {
    id: me.id,
    username: me.username,
    displayName: me.displayName,
    avatarUrl: me.avatarUrl,
  };
  useAuthStore.getState().setSession(user);
}

export function errorCode(err: unknown): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  return (err.body as { code?: string } | undefined)?.code;
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

// Backend set lại cookie phiên mới trong response (xem changePassword controller),
// nên không cần tự cập nhật token phía client như mobile.
export function changePassword(oldPassword: string, newPassword: string) {
  return apiClient.patch<unknown>("/users/me/password", { oldPassword, newPassword });
}

export async function deactivateAccount(password?: string) {
  await apiClient.delete<void>("/users/me", password ? { password } : {});
  clearSession();
}
