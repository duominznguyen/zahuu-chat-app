import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState } from "@/components/error-state";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { confirm } from "@/lib/confirm";
import { deactivateAccount, errorCode, useMe } from "@/lib/users";

export default function SettingsDeactivate() {
  const meQuery = useMe();

  if (meQuery.isError) return <ErrorState onRetry={() => meQuery.refetch()} />;
  if (!meQuery.data) return null;
  return meQuery.data.hasPassword ? <PasswordConfirm /> : <GoogleOnlyConfirm />;
}

function DeactivateIntro() {
  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Vô hiệu hoá tài khoản</h1>
      <p className="text-foreground">
        Tài khoản của bạn sẽ bị ẩn khỏi mọi người, bạn sẽ không thể đăng nhập bằng tài khoản này cho tới khi kích hoạt lại.
      </p>
      <p className="text-sm text-muted-foreground">
        Đăng nhập lại bất cứ lúc nào để kích hoạt lại tài khoản.
      </p>
    </>
  );
}

// Tự về /login không kèm ?redirect, nếu không tài khoản đăng nhập kế tiếp sẽ
// bị đưa thẳng vào trang vô hiệu hoá của tài khoản vừa rời đi.
function useGoToLogin() {
  const navigate = useNavigate();
  return () => navigate("/login", { replace: true });
}

function PasswordConfirm() {
  const [password, setPassword] = useState("");
  const goToLogin = useGoToLogin();

  const mutation = useMutation({
    mutationFn: (pw: string) => deactivateAccount(pw),
    onSuccess: goToLogin,
    onError: (err) =>
      toast.error(
        errorCode(err) === "INVALID_PASSWORD"
          ? "Mật khẩu không đúng"
          : "Vô hiệu hoá thất bại, vui lòng thử lại",
      ),
  });

  return (
    <div className="flex flex-col gap-6">
      <DeactivateIntro />
      <FormField
        label="Nhập mật khẩu để xác nhận"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errorCode(mutation.error) === "INVALID_PASSWORD" ? "Mật khẩu không đúng" : undefined}
      />
      <div>
        <Button
          variant="destructive"
          disabled={password.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate(password)}
        >
          Vô hiệu hoá tài khoản
        </Button>
      </div>
    </div>
  );
}

// Tài khoản Google không có mật khẩu để xác nhận — bù bằng hộp thoại xác nhận
// vì đây là hành động phá hủy mà không có bước nhập lại gì khác.
function GoogleOnlyConfirm() {
  const goToLogin = useGoToLogin();
  const mutation = useMutation({
    mutationFn: () => deactivateAccount(),
    onSuccess: goToLogin,
    onError: () => toast.error("Vô hiệu hoá thất bại, vui lòng thử lại"),
  });

  const handleClick = async () => {
    const ok = await confirm({
      title: "Vô hiệu hoá tài khoản?",
      description: "Bạn sẽ bị đăng xuất. Đăng nhập lại bằng Google để kích hoạt lại tài khoản.",
      confirmLabel: "Vô hiệu hoá",
      destructive: true,
    });
    if (ok) mutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <DeactivateIntro />
      <div>
        <Button variant="destructive" disabled={mutation.isPending} onClick={handleClick}>
          Vô hiệu hoá tài khoản
        </Button>
      </div>
    </div>
  );
}
