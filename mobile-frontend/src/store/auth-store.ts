import { create } from 'zustand';

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
  setReady: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isReady: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  setReady: () => set({ isReady: true }),
  clear: () => set({ accessToken: null, user: null }),
}));
