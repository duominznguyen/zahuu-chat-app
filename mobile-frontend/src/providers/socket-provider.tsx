import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

import { useToast } from "@/components/ui/toast";
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  subscribeSocket,
} from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";

export function useSocket() {
  return useSyncExternalStore(subscribeSocket, getSocket);
}

// Chỉ phụ thuộc CÓ token hay không (boolean), không phụ thuộc giá trị token —
// access token đổi mỗi lần refresh (15 phút/lần) nhưng không cần reconnect lại
// socket mỗi lần đó, chỉ cần connect lúc đăng nhập và disconnect lúc đăng xuất.
export function SocketProvider({ children }: { children: ReactNode }) {
  const hasToken = useAuthStore((s) => !!s.accessToken);
  const socket = useSocket();
  const queryClient = useQueryClient();
  const toast = useToast();
  // Chỉ toast "Đã kết nối lại" nếu trước đó THỰC SỰ đã rớt mạng — tránh toast
  // thừa ngay lần connect đầu tiên lúc mới mở app.
  const didDisconnect = useRef(false);
  // Đọc trong handler thay vì đóng kín giá trị hasToken lúc effect chạy — logout
  // tự gọi socket.disconnect() nên cũng bắn 'disconnect', phải phân biệt được
  // với rớt mạng thật để không hiện toast sai ("đang thử kết nối lại" khi thực
  // ra người dùng vừa chủ động đăng xuất).
  const hasTokenRef = useRef(hasToken);
  useEffect(() => {
    hasTokenRef.current = hasToken;
  }, [hasToken]);

  useEffect(() => {
    if (!hasToken) return;
    connectSocket();
    return () => disconnectSocket();
  }, [hasToken]);

  useEffect(() => {
    if (!socket) return;
    const onDisconnect = () => {
      if (!hasTokenRef.current) return;
      didDisconnect.current = true;
      toast.show("Mất kết nối, đang thử kết nối lại...");
    };
    const onReconnect = () => {
      if (!didDisconnect.current) return;
      didDisconnect.current = false;
      toast.show("Đã kết nối lại");
      // Dữ liệu có thể đã lỗi thời trong lúc mất kết nối (bỏ lỡ socket event) ->
      // refetch lại toàn bộ thay vì cố theo dõi chính xác đã bỏ lỡ gì.
      queryClient.invalidateQueries();
    };
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onReconnect);
    };
  }, [socket, queryClient, toast]);

  return children;
}
