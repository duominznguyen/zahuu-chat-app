import { useSyncExternalStore } from "react";

// useSyncExternalStore thay vì useState+useEffect — tránh phải tự đồng bộ giá
// trị ban đầu rồi set lại trong effect (dễ gây 1 lần render sai trước khi kịp
// cập nhật, vd layout nháy sai lúc tải trang).
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

// Breakpoint 3 cột theo kế hoạch (web-frontend-plan.md mục 3) — dùng chung,
// không lặp lại chuỗi "(min-width: 1024px)" ở nhiều nơi.
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
