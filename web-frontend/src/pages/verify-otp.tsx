import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/otp-input";
import { resendOtp, verifyEmail } from "@/lib/auth";
import { useRedirectTarget } from "@/lib/use-redirect-target";

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = useRedirectTarget();
  const email = params.get("email") ?? "";
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(Number(params.get("resendAfterSeconds") ?? 0));

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: () => verifyEmail(email, otp),
    onSuccess: () => navigate(redirect, { replace: true }),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendOtp(email),
    onSuccess: (res) => setCooldown(res.resendAfterSeconds),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-center text-2xl font-semibold text-foreground">Xác thực email</h1>
        <p className="text-center text-muted-foreground">
          Mã xác thực 6 số đã được gửi tới {email}
        </p>

        <OtpInput
          value={otp}
          onChange={setOtp}
          error={verifyMutation.isError ? "Mã xác thực không đúng hoặc đã hết hạn" : undefined}
        />

        <Button
          size="lg"
          disabled={otp.length !== 6 || verifyMutation.isPending}
          onClick={() => verifyMutation.mutate()}
        >
          Xác nhận
        </Button>

        <Button
          variant="link"
          disabled={cooldown > 0 || resendMutation.isPending}
          onClick={() => resendMutation.mutate()}
        >
          {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : "Gửi lại mã"}
        </Button>
      </div>
    </div>
  );
}
