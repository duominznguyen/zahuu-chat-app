import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";
import { useRedirectTarget } from "@/lib/use-redirect-target";

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const redirect = useRedirectTarget();

  if (isAuthenticated) {
    return <Navigate to={redirect} replace />;
  }

  return children;
}
