import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  cancelFriendRequest,
  getUserProfile,
  listFriendRequests,
  respondFriendRequest,
  sendFriendRequest,
} from "@/lib/friends";
import { useSocket } from "@/providers/socket-provider";

// Thanh kết bạn nhanh trong đoạn chat 1-1 với người chưa là bạn bè. Dùng chung
// query key với trang profile để 2 nơi luôn hiện cùng 1 trạng thái.
export function FriendshipBar({ userId, name }: { userId: string; name: string }) {
  const queryClient = useQueryClient();
  const socket = useSocket();

  const profileQuery = useQuery({
    queryKey: ["users", "profile", userId],
    queryFn: () => getUserProfile(userId),
  });
  // Refetch lỗi (vd vừa bị chặn → 404) vẫn giữ data cũ, nên phải bỏ qua data khi đang lỗi.
  const status = profileQuery.isError ? undefined : profileQuery.data?.relationshipStatus;

  // Profile không trả id lời mời — tra trong danh sách lời mời để chấp nhận/huỷ đúng lời mời.
  const receivedQuery = useQuery({
    queryKey: ["friend-requests", "received"],
    queryFn: () => listFriendRequests("received"),
    enabled: status === "pending_received",
  });
  const sentQuery = useQuery({
    queryKey: ["friend-requests", "sent"],
    queryFn: () => listFriendRequests("sent"),
    enabled: status === "pending_sent",
  });
  const receivedRequestId = receivedQuery.data?.find((r) => r.user.id === userId)?.id;
  const sentRequestId = sentQuery.data?.find((r) => r.user.id === userId)?.id;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["users", "profile", userId] });
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
  };

  useEffect(() => {
    if (!socket) return;
    // Người kia gửi/chấp nhận lời mời thì thanh phải đổi ngay, không đợi hết staleTime.
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["users", "profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    };
    socket.on("friend:requestReceived", refresh);
    socket.on("friend:accepted", refresh);
    return () => {
      socket.off("friend:requestReceived", refresh);
      socket.off("friend:accepted", refresh);
    };
  }, [socket, queryClient, userId]);

  const sendMutation = useMutation({
    mutationFn: () => sendFriendRequest(userId),
    onSuccess: (res) => {
      toast.success(res.status === "accepted" ? "Hai bạn đã là bạn bè" : "Đã gửi lời mời kết bạn");
      invalidate();
    },
    // Lỗi thường do trạng thái hiển thị đã cũ (vd người kia vừa gửi lời mời) — tải lại để thanh tự đúng.
    onError: () => {
      toast.error("Gửi lời mời thất bại, vui lòng thử lại");
      invalidate();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => cancelFriendRequest(requestId),
    onSuccess: () => {
      toast.success("Đã hủy lời mời kết bạn");
      invalidate();
    },
    onError: () => {
      toast.error("Hủy lời mời thất bại, vui lòng thử lại");
      invalidate();
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: "accept" | "reject" }) =>
      respondFriendRequest(requestId, action),
    onSuccess: (_res, { action }) => {
      toast.success(action === "accept" ? "Đã chấp nhận lời mời" : "Đã từ chối lời mời");
      invalidate();
    },
    onError: () => {
      toast.error("Thao tác thất bại, vui lòng thử lại");
      invalidate();
    },
  });

  let text: string;
  let actions: ReactNode;
  if (status === "none") {
    text = "Hai bạn chưa là bạn bè";
    actions = (
      <Button size="sm" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
        <UserPlus />
        Kết bạn
      </Button>
    );
  } else if (status === "pending_sent") {
    text = "Đã gửi lời mời kết bạn";
    actions = (
      <Button
        size="sm"
        variant="outline"
        disabled={!sentRequestId || cancelMutation.isPending}
        onClick={() => sentRequestId && cancelMutation.mutate(sentRequestId)}
      >
        Hủy lời mời
      </Button>
    );
  } else if (status === "pending_received") {
    text = `${name} đã gửi lời mời kết bạn`;
    const disabled = !receivedRequestId || respondMutation.isPending;
    actions = (
      <>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => receivedRequestId && respondMutation.mutate({ requestId: receivedRequestId, action: "reject" })}
        >
          Từ chối
        </Button>
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => receivedRequestId && respondMutation.mutate({ requestId: receivedRequestId, action: "accept" })}
        >
          Chấp nhận
        </Button>
      </>
    );
  } else {
    // Đã là bạn, đã chặn, hoặc profile không tải được (bị người kia chặn → 404).
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/60 px-4 py-2 text-sm">
      <span className="min-w-0 truncate text-foreground">{text}</span>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}
