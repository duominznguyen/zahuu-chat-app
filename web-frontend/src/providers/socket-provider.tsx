import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { connectSocket, disconnectSocket, getSocket, subscribeSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";

export function useSocket() {
  return useSyncExternalStore(subscribeSocket, getSocket);
}

// Chỉ phụ thuộc CÓ đăng nhập hay không (boolean), không phụ thuộc user cụ thể
// đổi — connect lúc đăng nhập, disconnect lúc đăng xuất, không reconnect giữa
// chừng vì lý do khác (vd token đổi — cookie tự lo, xem src/lib/socket.ts).
export function SocketProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const socket = useSocket();
  const queryClient = useQueryClient();
  // Chỉ toast "Đã kết nối lại" nếu trước đó THỰC SỰ đã rớt mạng — tránh toast
  // thừa ngay lần connect đầu tiên lúc mới mở app.
  const didDisconnect = useRef(false);
  // Đọc trong handler thay vì đóng kín giá trị isAuthenticated lúc effect chạy
  // — logout tự gọi socket.disconnect() nên cũng bắn 'disconnect', phải phân
  // biệt được với rớt mạng thật để không hiện toast sai lúc người dùng chỉ
  // đang chủ động đăng xuất bình thường.
  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    connectSocket();
    return () => disconnectSocket();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!socket) return;
    const onDisconnect = () => {
      if (!isAuthenticatedRef.current) return;
      didDisconnect.current = true;
      toast.info("Mất kết nối, đang thử kết nối lại...");
    };
    const onReconnect = () => {
      if (!didDisconnect.current) return;
      didDisconnect.current = false;
      toast.success("Đã kết nối lại");
      // Dữ liệu có thể đã lỗi thời trong lúc mất kết nối (bỏ lỡ socket event)
      // -> refetch lại toàn bộ thay vì cố theo dõi chính xác đã bỏ lỡ gì.
      queryClient.invalidateQueries();
    };
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onReconnect);
    };
  }, [socket, queryClient]);

  return children;
}
