import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { OtpInput } from "@/components/otp-input";
import { resetPassword } from "@/lib/auth";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => resetPassword(email, otp, newPassword),
    onSuccess: () => {
      toast.success("Đặt lại mật khẩu thành công, hãy đăng nhập lại");
      // redirect (nếu có) vẫn giữ nguyên qua query string để tới đúng đích sau khi đăng nhập lại.
      navigate({ pathname: "/login", search: location.search }, { replace: true });
    },
  });

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    otp.length === 6 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !mutation.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-center text-2xl font-semibold text-foreground">Đặt lại mật khẩu</h1>
        <p className="text-center text-muted-foreground">Nhập mã đã gửi tới {email}</p>

        <OtpInput
          value={otp}
          onChange={setOtp}
          error={mutation.isError ? "Mã không đúng hoặc đã hết hạn" : undefined}
        />
        <FormField
          label="Mật khẩu mới"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <FormField
          label="Xác nhận mật khẩu mới"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={passwordMismatch ? "Mật khẩu xác nhận không khớp" : undefined}
        />

        <Button size="lg" disabled={!canSubmit} onClick={() => mutation.mutate()}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Đặt lại mật khẩu
        </Button>
      </div>
    </div>
  );
}
