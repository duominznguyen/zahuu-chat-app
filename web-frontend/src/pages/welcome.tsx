import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { OrDivider } from "@/components/or-divider";

export default function Welcome() {
  const location = useLocation();

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
          <Link to={{ pathname: "/register", search: location.search }}>Đăng ký</Link>
        </Button>

        <OrDivider />

        <GoogleSignInButton />
      </div>
    </div>
  );
}
