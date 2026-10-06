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
    // Từ chối/huỷ lời mời, huỷ kết bạn, chặn/bỏ chặn từ phía bên kia (hoặc từ
    // tab khác của mình) — nghe 1 lần ở đây thay vì mỗi màn tự nghe, vì nhiều
    // nơi cùng đọc các query này (thanh kết bạn, profile, danh sách bạn bè, ô nhập tin).
    const onRelationshipChanged = ({ userId }: { userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["users", "profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
      // Hết là bạn bè (huỷ kết bạn/chặn) thì backend ẩn trạng thái online ở cả list lẫn chi tiết.
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    };
    // Vừa kết bạn: tải lại hội thoại (online chỉ hiện giữa bạn bè, người đó
    // chuyển từ mục "Người chưa kết bạn" sang "Bạn bè" trong ô tìm kiếm) và
    // bạn bè — không chỉ màn Bạn bè mới cần, ô tìm kiếm của danh sách chat cũng đọc.
    const onFriendAccepted = () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    };
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onReconnect);
    socket.on("relationship:changed", onRelationshipChanged);
    socket.on("friend:accepted", onFriendAccepted);
    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onReconnect);
      socket.off("relationship:changed", onRelationshipChanged);
      socket.off("friend:accepted", onFriendAccepted);
    };
  }, [socket, queryClient]);

  return children;
}
