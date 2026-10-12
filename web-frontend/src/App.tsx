import { QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, type Location } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShellLayout } from "@/components/app-shell/app-shell-layout";
import { CallOverlays } from "@/components/call-overlays";
import { ConfirmDialogHost } from "@/components/confirm-dialog-host";
import { TextPromptDialogHost } from "@/components/text-prompt-dialog-host";
import { ProtectedRoute } from "@/components/protected-route";
import { PublicOnlyRoute } from "@/components/public-only-route";
import { TooltipProvider } from "@/components/ui/tooltip";
import { bootstrapAuth } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { SocketProvider } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";
import AddMembersModal from "@/pages/add-members-modal";
import AddMembersStandalone from "@/pages/add-members-standalone";
import ChatEmpty from "@/pages/chat-empty";
import Conversation from "@/pages/conversation";
import CreateGroupModal from "@/pages/create-group-modal";
import CreateGroupStandalone from "@/pages/create-group-standalone";
import ForgotPassword from "@/pages/forgot-password";
import FriendProfile from "@/pages/friend-profile";
import FriendsEmpty from "@/pages/friends-empty";
import GroupMembersModal from "@/pages/group-members-modal";
import GroupMembersStandalone from "@/pages/group-members-standalone";
import InviteLinkModal from "@/pages/invite-link-modal";
import InviteLinkStandalone from "@/pages/invite-link-standalone";
import InviteToken from "@/pages/invite-token";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ResetPassword from "@/pages/reset-password";
import UserProfileModal from "@/pages/user-profile-modal";
import UserProfileStandalone from "@/pages/user-profile-standalone";
import VerifyOtp from "@/pages/verify-otp";
import Welcome from "@/pages/welcome";
import SettingsAppearance from "@/pages/settings-appearance";
import SettingsBlocked from "@/pages/settings-blocked";
import SettingsDeactivate from "@/pages/settings-deactivate";
import SettingsLayout from "@/pages/settings-layout";
import SettingsPassword from "@/pages/settings-password";
import SettingsProfile from "@/pages/settings-profile";
import SettingsUsername from "@/pages/settings-username";

// Danh sách path dùng kỹ thuật "background location" (modal đè lên route nền
// thay vì thay thế hẳn) — xem mục "Modal route" web-frontend-plan.md.
function ModalRoutes() {
  return (
    <Routes>
      <Route path="/u/:userId" element={<UserProfileModal />} />
      <Route path="/create-group" element={<CreateGroupModal />} />
      <Route path="/add-members/:conversationId" element={<AddMembersModal />} />
      <Route path="/group-members/:conversationId" element={<GroupMembersModal />} />
      <Route path="/invite-link/:conversationId" element={<InviteLinkModal />} />
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
          <Route path="/chat/:conversationId" element={<Conversation />} />
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
        <Route
          path="/create-group"
          element={
            <ProtectedRoute>
              <CreateGroupStandalone />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-members/:conversationId"
          element={
            <ProtectedRoute>
              <AddMembersStandalone />
            </ProtectedRoute>
          }
        />
        <Route
          path="/group-members/:conversationId"
          element={
            <ProtectedRoute>
              <GroupMembersStandalone />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invite-link/:conversationId"
          element={
            <ProtectedRoute>
              <InviteLinkStandalone />
            </ProtectedRoute>
          }
        />

        {/* Trang riêng (không phải modal) — xem preview + xác nhận join nhóm */}
        <Route
          path="/invite/:token"
          element={
            <ProtectedRoute>
              <InviteToken />
            </ProtectedRoute>
          }
        />

        {/* Full-screen overlay, không nằm trong AppShellLayout — xem mục 3 web-frontend-plan.md */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<SettingsProfile />} />
          <Route path="username" element={<SettingsUsername />} />
          <Route path="password" element={<SettingsPassword />} />
          <Route path="blocked" element={<SettingsBlocked />} />
          <Route path="appearance" element={<SettingsAppearance />} />
          <Route path="deactivate" element={<SettingsDeactivate />} />
        </Route>

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
            <CallOverlays />
          </SocketProvider>
        </BrowserRouter>
      </TooltipProvider>
      <Toaster richColors position="top-center" />
      <ConfirmDialogHost />
      <TextPromptDialogHost />
    </QueryClientProvider>
  );
}

export default App;
