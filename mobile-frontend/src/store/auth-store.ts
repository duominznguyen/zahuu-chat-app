import { create } from "zustand";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  // false trong lúc app đọc token cũ từ SecureStore lúc khởi động — tránh
  // flash màn hình login rồi lại chuyển sang app chính ngay khi đã có session.
  isReady: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  // Dùng riêng lúc bootstrap (sau khi refresh token nhưng chưa kịp fetch /users/me) —
  // apiClient cần accessToken trong store trước khi có thể gọi API lấy user.
  setAccessToken: (accessToken: string) => void;
  setReady: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isReady: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setReady: () => set({ isReady: true }),
  clear: () => set({ accessToken: null, user: null }),
}));
