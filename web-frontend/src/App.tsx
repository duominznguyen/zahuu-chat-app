import { QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, type Location } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { ConfirmDialogHost } from "@/components/confirm-dialog-host";
import { ProtectedRoute } from "@/components/protected-route";
import { PublicOnlyRoute } from "@/components/public-only-route";
import { TooltipProvider } from "@/components/ui/tooltip";
import { bootstrapAuth } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { SocketProvider } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";
import ChatEmpty from "@/pages/chat-empty";
import ConversationPlaceholder from "@/pages/conversation-placeholder";
import ForgotPassword from "@/pages/forgot-password";
import FriendProfile from "@/pages/friend-profile";
import FriendsEmpty from "@/pages/friends-empty";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ResetPassword from "@/pages/reset-password";
import UserProfileModal from "@/pages/user-profile-modal";
import UserProfileStandalone from "@/pages/user-profile-standalone";
import VerifyOtp from "@/pages/verify-otp";
import Welcome from "@/pages/welcome";

// Danh sách path dùng kỹ thuật "background location" (modal đè lên route nền
// thay vì thay thế hẳn) — hiện chỉ có /u/:userId (dùng ngay từ W4), các path
// quản lý nhóm (/create-group, /add-members/:id, /group-members/:id,
// /invite-link/:id) sẽ thêm vào đây khi làm W8, dùng CHUNG cơ chế này, không
// viết lại logic riêng — xem mục "Modal route" web-frontend-plan.md.
function ModalRoutes() {
  return (
    <Routes>
      <Route path="/u/:userId" element={<UserProfileModal />} />
    </Routes>
  );
}

function AppRoutes() {
  const isReady = useAuthStore((s) => s.isReady);
  const location = useLocation();
  const background = (location.state as { background?: Location } | null)?.background;

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
    <>
      <Routes location={background ?? location}>
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
          element={
            <ProtectedRoute>
              <AppShellLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/chat" element={<ChatEmpty />} />
          <Route path="/chat/:conversationId" element={<ConversationPlaceholder />} />
          <Route path="/friends" element={<FriendsEmpty />} />
          <Route path="/friends/:userId" element={<FriendProfile />} />
        </Route>

        {/* Bản độc lập — chỉ render khi KHÔNG có background (vào thẳng URL) */}
        <Route
          path="/u/:userId"
          element={
            <ProtectedRoute>
              <UserProfileStandalone />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {background && <ModalRoutes />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <SocketProvider>
            <AppRoutes />
          </SocketProvider>
        </BrowserRouter>
      </TooltipProvider>
      <Toaster richColors position="top-center" />
      <ConfirmDialogHost />
    </QueryClientProvider>
  );
}

export default App;
