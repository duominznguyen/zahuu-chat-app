import { create } from "zustand";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  // false trong lúc bootstrap đang thử /auth/refresh bằng cookie — tránh
  // nháy màn hình login rồi lại chuyển sang app chính ngay khi đã có session.
  isReady: boolean;
  setSession: (user: AuthUser) => void;
  setReady: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isReady: false,
  setSession: (user) => set({ user, isAuthenticated: true }),
  setReady: () => set({ isReady: true }),
  clear: () => set({ user: null, isAuthenticated: false }),
}));
