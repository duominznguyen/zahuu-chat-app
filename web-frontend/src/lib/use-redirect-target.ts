import { useSearchParams } from "react-router-dom";

// Đích điều hướng sau khi đăng nhập/đăng ký thành công — ProtectedRoute đính
// kèm query param này khi đá người dùng chưa đăng nhập sang /login, giữ lại
// đích đến ban đầu thay vì luôn cứng về /chat (xem ProtectedRoute).
export function useRedirectTarget() {
  const [params] = useSearchParams();
  return params.get("redirect") || "/chat";
}
