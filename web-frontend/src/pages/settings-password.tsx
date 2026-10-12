import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/error-state";
import { FormField } from "@/components/form-field";
import { OtpInput } from "@/components/otp-input";
import { Button } from "@/components/ui/button";
import { forgotPassword, resetPassword } from "@/lib/auth";
import { changePassword, errorCode, useMe } from "@/lib/users";

export default function SettingsPassword() {
  const meQuery = useMe();

  if (meQuery.isError) return <ErrorState onRetry={() => meQuery.refetch()} />;
  if (!meQuery.data) return null;
  return meQuery.data.hasPassword ? (
    <ChangePasswordForm />
  ) : (
    <SetPasswordForm email={meQuery.data.email} />
  );
}

function ChangePasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => changePassword(oldPassword, newPassword),
    onSuccess: () => {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Đã đổi mật khẩu");
    },
  });

  const code = errorCode(mutation.error);
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    oldPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !mutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Đổi mật khẩu</h1>
      <FormField
        label="Mật khẩu hiện tại"
        type="password"
        autoComplete="current-password"
        value={oldPassword}
        onChange={(e) => setOldPassword(e.target.value)}
        error={code === "INVALID_OLD_PASSWORD" ? "Mật khẩu hiện tại không đúng" : undefined}
      />
      <FormField
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={code === "SAME_PASSWORD" ? "Mật khẩu mới phải khác mật khẩu hiện tại" : undefined}
      />
      <p className="-mt-3 text-xs text-muted-foreground">Tối thiểu 8 ký tự.</p>
      <FormField
        label="Xác nhận mật khẩu mới"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={passwordMismatch ? "Mật khẩu xác nhận không khớp" : undefined}
      />
      <div>
        <Button disabled={!canSubmit} onClick={() => mutation.mutate()}>
          Lưu
        </Button>
      </div>
    </div>
  );
}

// Tài khoản chỉ đăng nhập bằng Google đặt mật khẩu qua đúng luồng OTP quên mật khẩu
// của backend — email đã biết sẵn từ hồ sơ nên không hỏi lại.
function SetPasswordForm({ email }: { email: string }) {
  const queryClient = useQueryClient();
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const sendOtpMutation = useMutation({
    mutationFn: () => forgotPassword(email),
    onSuccess: () => setOtpSent(true),
    onError: () => toast.error("Không gửi được mã, vui lòng thử lại"),
  });

  const setPasswordMutation = useMutation({
    mutationFn: () => resetPassword(email, otp, newPassword),
    onSuccess: () => {
      toast.success("Đã đặt mật khẩu");
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
    onError: () => toast.error("Mã không đúng hoặc đã hết hạn"),
  });

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    otp.length === 6 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !setPasswordMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Đặt mật khẩu</h1>

      {!otpSent ? (
        <>
          <p className="text-muted-foreground">
            Gửi mã xác thực tới {email} để đặt mật khẩu cho tài khoản.
          </p>
          <div>
            <Button disabled={sendOtpMutation.isPending} onClick={() => sendOtpMutation.mutate()}>
              Gửi mã
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">Nhập mã đã gửi tới {email}</p>
          <OtpInput value={otp} onChange={setOtp} />
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
          <div>
            <Button disabled={!canSubmit} onClick={() => setPasswordMutation.mutate()}>
              Đặt mật khẩu
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
