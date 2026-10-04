import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { ApiError } from "@/lib/api-client";
import { register } from "@/lib/auth";

const METHOD_LABEL: Record<string, string> = {
  PASSWORD: "mật khẩu",
  GOOGLE: "Google",
};

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => register(email.trim(), displayName.trim(), password),
    onSuccess: (res) => {
      const params = new URLSearchParams(location.search);
      params.set("email", email.trim());
      params.set("resendAfterSeconds", String(res.resendAfterSeconds));
      navigate(`/verify-otp?${params.toString()}`);
    },
  });

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit =
    email.trim().length > 0 &&
    displayName.trim().length > 0 &&
    password.length >= 8 &&
    password === confirmPassword &&
    !mutation.isPending;

  const emailExists =
    mutation.error instanceof ApiError &&
    (mutation.error.body as { code?: string })?.code === "EMAIL_EXISTS";
  const existingMethods = emailExists
    ? ((mutation.error as ApiError).body as { methods: string[] }).methods
    : [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <form
        className="flex w-full max-w-sm flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
      >
        <h1 className="text-center text-2xl font-semibold text-foreground">Đăng ký</h1>

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Tên hiển thị"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <FormField
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormField
          label="Xác nhận mật khẩu"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={passwordMismatch ? "Mật khẩu xác nhận không khớp" : undefined}
        />

        {emailExists && (
          <div className="flex flex-col gap-2 rounded-xl bg-warning/10 p-3">
            <p className="text-sm text-foreground">
              Email này đã đăng ký bằng{" "}
              {existingMethods.map((m) => METHOD_LABEL[m] ?? m).join(" hoặc ")}.
            </p>
            <Link
              to={{ pathname: "/login", search: location.search }}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Đăng nhập ngay
            </Link>
          </div>
        )}
        {mutation.isError && !emailExists && (
          <p className="text-sm text-danger">Không thể đăng ký, vui lòng thử lại</p>
        )}

        <Button type="submit" size="lg" disabled={!canSubmit}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Đăng ký
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản?{" "}
          <Link
            to={{ pathname: "/login", search: location.search }}
            className="font-medium text-primary hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
}
