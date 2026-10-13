import * as SecureStore from "expo-secure-store";
import { colorScheme } from "nativewind";
import { Platform } from "react-native";
import { create } from "zustand";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "zahuu_theme_preference";
// expo-secure-store không có bản web (xem secure-store.ts) — web chỉ dùng để
// tự kiểm tra UI nên không cần nhớ lựa chọn qua lần tải lại.
const isWeb = Platform.OS === "web";

function isPreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

interface ThemeState {
  preference: ThemePreference;
}

export const useThemeStore = create<ThemeState>(() => ({
  preference: "system",
}));

// Trên native, colorScheme.set() của NativeWind gọi Appearance.setColorScheme
// nên ghi đè cho CẢ app — class `dark:` lẫn useColorScheme() của React Native
// (màu icon, theme của navigation) đổi cùng lúc, không lệch nhau.
function applyTheme(preference: ThemePreference) {
  colorScheme.set(preference);
  useThemeStore.setState({ preference });
}

// Gọi 1 lần lúc app khởi động. Không gắn với tài khoản — đăng xuất không xoá,
// giống cài đặt của thiết bị.
export async function loadThemePreference() {
  if (isWeb) return;
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (isPreference(stored) && stored !== "system") applyTheme(stored);
  } catch {
    // Đọc lỗi thì giữ mặc định theo hệ thống, không chặn app khởi động.
  }
}

export async function setThemePreference(preference: ThemePreference) {
  applyTheme(preference);
  if (isWeb) return;
  await SecureStore.setItemAsync(STORAGE_KEY, preference).catch(() => {});
}
