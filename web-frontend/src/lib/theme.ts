export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

function resolveIsDark(preference: ThemePreference): boolean {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return preference === "dark";
}

function applyTheme(preference: ThemePreference) {
  document.documentElement.classList.toggle("dark", resolveIsDark(preference));
}

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

// Dùng ở màn Cài đặt (W12) cho nút chuyển Sáng/Tối/Theo hệ thống.
export function setThemePreference(preference: ThemePreference) {
  localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(preference);
}

// Gọi 1 lần lúc app khởi động (main.tsx), TRƯỚC khi render — tránh nháy sai theme.
export function initTheme() {
  applyTheme(getThemePreference());

  // Preference đang "system" thì tự áp dụng lại nếu OS đổi theme ngay lúc app đang mở.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemePreference() === "system") applyTheme("system");
  });
}
