import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loginWithGoogle } from "@/lib/auth";
import { useRedirectTarget } from "@/lib/use-redirect-target";

// Dùng chung cho Welcome/Login/Register — PHẢI có mặt ở cả Login/Register,
// không chỉ Welcome: ProtectedRoute đá người chưa đăng nhập thẳng tới
// /login?redirect=... (không qua /), nên nếu chỉ đặt ở Welcome, tình huống
// phổ biến nhất (mở link cần đăng nhập) sẽ không bao giờ thấy được nút này.
export function GoogleSignInButton() {
  const navigate = useNavigate();
  const redirect = useRedirectTarget();

  const mutation = useMutation({
    mutationFn: loginWithGoogle,
    onSuccess: (res) => {
      if (res.reactivated) toast.success("Tài khoản đã được kích hoạt lại");
      navigate(redirect, { replace: true });
    },
    onError: (err) => {
      const unavailable =
        err instanceof Error &&
        (err.message === "GOOGLE_PROMPT_UNAVAILABLE" || err.message === "GOOGLE_PROMPT_TIMEOUT");
      toast.error(
        unavailable
          ? "Không hiện được hộp thoại Google — kiểm tra trình duyệt có chặn cookie bên thứ 3 không"
          : "Đăng nhập Google thất bại, vui lòng thử lại",
      );
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      Tiếp tục với Google
    </Button>
  );
}
