import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { OrDivider } from "@/components/or-divider";
import { ApiError } from "@/lib/api-client";
import { login } from "@/lib/auth";
import { useRedirectTarget } from "@/lib/use-redirect-target";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = useRedirectTarget();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: (res) => {
      if (res.reactivated) toast.success("Tài khoản đã được kích hoạt lại");
      navigate(redirect, { replace: true });
    },
  });

  const canSubmit = email.trim().length > 0 && password.length > 0 && !mutation.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <form
        className="flex w-full max-w-sm flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
      >
        <h1 className="text-center text-2xl font-semibold text-foreground">Đăng nhập</h1>

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Link
          to={{ pathname: "/forgot-password", search: location.search }}
          className="self-end text-sm font-medium text-primary hover:underline"
        >
          Quên mật khẩu?
        </Link>

        {mutation.isError && (
          <p className="text-sm text-danger">
            {mutation.error instanceof ApiError
              ? "Sai email hoặc mật khẩu"
              : "Không kết nối được máy chủ, vui lòng thử lại"}
          </p>
        )}

        <Button type="submit" size="lg" disabled={!canSubmit}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Đăng nhập
        </Button>

        <OrDivider />

        <GoogleSignInButton />

        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link
            to={{ pathname: "/register", search: location.search }}
            className="font-medium text-primary hover:underline"
          >
            Đăng ký
          </Link>
        </p>
      </form>
    </div>
  );
}
