import { QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ProtectedRoute } from "@/components/protected-route";
import { PublicOnlyRoute } from "@/components/public-only-route";
import { bootstrapAuth } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/store/auth-store";
import ForgotPassword from "@/pages/forgot-password";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ResetPassword from "@/pages/reset-password";
import VerifyOtp from "@/pages/verify-otp";
import Welcome from "@/pages/welcome";

// Placeholder tạm cho khu vực đã đăng nhập — layout 3 cột thật làm ở W4.
function ChatPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      Đã đăng nhập — layout 3 cột sẽ làm ở W4
    </div>
  );
}

function AppRoutes() {
  const isReady = useAuthStore((s) => s.isReady);

  useEffect(() => {
    bootstrapAuth();
  }, []);

  // Giữ 1 spinner toàn màn hình tới khi biết chắc có session hay không — tránh
  // nháy qua màn đăng nhập rồi mới chuyển vào app khi thật ra đã có session cũ.
  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <Welcome />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/verify-otp"
        element={
          <PublicOnlyRoute>
            <VerifyOtp />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPassword />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicOnlyRoute>
            <ResetPassword />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPlaceholder />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

export default App;
