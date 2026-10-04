import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { forgotPassword } from "@/lib/auth";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: () => forgotPassword(email.trim()),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-center text-2xl font-semibold text-foreground">Quên mật khẩu</h1>
        <p className="text-center text-muted-foreground">
          Nhập email để nhận mã đặt lại mật khẩu
        </p>

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={mutation.isSuccess}
        />

        {mutation.isSuccess && (
          <p className="text-sm text-success">
            Nếu email đã đăng ký, mã đặt lại mật khẩu đã được gửi.
          </p>
        )}

        {!mutation.isSuccess ? (
          <Button
            size="lg"
            disabled={email.trim().length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Gửi mã
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => {
              const params = new URLSearchParams(location.search);
              params.set("email", email.trim());
              navigate(`/reset-password?${params.toString()}`);
            }}
          >
            Tôi đã nhận được mã
          </Button>
        )}
      </div>
    </div>
  );
}
