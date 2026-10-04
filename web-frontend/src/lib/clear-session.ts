import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "./query-client";
import { stopRefreshTimer } from "./token-refresh";

// Dùng chung cho MỌI nơi kết thúc session (logout chủ động, refresh token hết
// hạn, bootstrap thất bại) — KHÔNG tự xoá cookie ở đây (không có gì để xoá
// phía client, cookie do backend set/clear qua Set-Cookie — xem auth-cookie-
// migration.md). Thiếu queryClient.clear() thì cache tài khoản cũ (danh sách
// hội thoại, bạn bè...) vẫn còn trong bộ nhớ và hiện nhầm sang tài khoản mới
// đăng nhập ngay sau đó, trước khi kịp refetch (cùng bug mobile đã gặp).
export function clearSession() {
  stopRefreshTimer();
  queryClient.clear();
  useAuthStore.getState().clear();
}
