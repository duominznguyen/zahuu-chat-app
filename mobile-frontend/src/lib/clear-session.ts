import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "./query-client";
import { tokenStorage } from "./secure-store";

// Dùng chung cho MỌI nơi kết thúc session (logout chủ động, refresh token hết
// hạn, bootstrap thất bại) — thiếu queryClient.clear() thì cache tài khoản cũ
// (danh sách hội thoại, bạn bè...) vẫn còn trong bộ nhớ và hiện nhầm sang tài
// khoản mới đăng nhập ngay sau đó, trước khi kịp refetch.
export async function clearSession() {
  await tokenStorage.clear();
  useAuthStore.getState().clear();
  queryClient.clear();
}
