import { useMutation } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loginWithGoogle } from "@/lib/auth";
import { useRedirectTarget } from "@/lib/use-redirect-target";

export default function Welcome() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = useRedirectTarget();

  const googleMutation = useMutation({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-4xl font-bold text-primary">Zahuu</h1>
        <p className="text-base text-muted-foreground">Nhắn tin mọi lúc, mọi nơi</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button asChild size="lg">
          <Link to={{ pathname: "/login", search: location.search }}>Đăng nhập</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link to={{ pathname: "/register", search: location.search }}>
            Đăng ký
          </Link>
        </Button>

        <div className="flex items-center gap-3 py-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm text-muted-foreground">hoặc</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          size="lg"
          disabled={googleMutation.isPending}
          onClick={() => googleMutation.mutate()}
        >
          Tiếp tục với Google
        </Button>
      </div>
    </div>
  );
}
