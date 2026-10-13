import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useToast } from "@/components/ui";
import {
  cancelFriendRequest,
  getUserProfile,
  listFriendRequests,
  respondFriendRequest,
  sendFriendRequest,
} from "@/lib/friends";
import { useSocket } from "@/providers/socket-provider";

function BarButton({
  label,
  primary,
  disabled,
  onPress,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={`rounded-full px-3 py-1.5 active:opacity-70 ${
        primary
          ? "bg-primary dark:bg-primary-dark"
          : "border border-zinc-300 dark:border-zinc-600"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <Text
        className={`text-sm font-medium ${
          primary
            ? "text-white dark:text-zinc-900"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Thanh kết bạn nhanh trong đoạn chat 1-1 với người chưa là bạn bè. Dùng chung
// query key với màn UserProfile để 2 nơi luôn hiện cùng 1 trạng thái.
export function FriendshipBar({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const toast = useToast();

  const profileQuery = useQuery({
    queryKey: ["users", "profile", userId],
    queryFn: () => getUserProfile(userId),
  });
  // Refetch lỗi (vd vừa bị chặn → 404) vẫn giữ data cũ, nên bỏ qua data khi đang lỗi.
  const status = profileQuery.isError
    ? undefined
    : profileQuery.data?.relationshipStatus;

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
  const receivedRequestId = receivedQuery.data?.find(
    (r) => r.user.id === userId,
  )?.id;
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

  // Lỗi thường do trạng thái hiển thị đã cũ (vd người kia vừa gửi lời mời) —
  // tải lại để thanh tự đúng.
  const sendMutation = useMutation({
    mutationFn: () => sendFriendRequest(userId),
    onSuccess: (res) => {
      toast.show(
        res.status === "accepted"
          ? "Hai bạn đã là bạn bè"
          : "Đã gửi lời mời kết bạn",
      );
      invalidate();
    },
    onError: () => {
      toast.show("Gửi lời mời thất bại, vui lòng thử lại");
      invalidate();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => cancelFriendRequest(requestId),
    onSuccess: () => {
      toast.show("Đã hủy lời mời kết bạn");
      invalidate();
    },
    onError: () => {
      toast.show("Hủy lời mời thất bại, vui lòng thử lại");
      invalidate();
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({
      requestId,
      action,
    }: {
      requestId: string;
      action: "accept" | "reject";
    }) => respondFriendRequest(requestId, action),
    onSuccess: (_res, { action }) => {
      toast.show(
        action === "accept" ? "Đã chấp nhận lời mời" : "Đã từ chối lời mời",
      );
      invalidate();
    },
    onError: () => {
      toast.show("Thao tác thất bại, vui lòng thử lại");
      invalidate();
    },
  });

  let text: string;
  let actions: ReactNode;
  if (status === "none") {
    text = "Hai bạn chưa là bạn bè";
    actions = (
      <BarButton
        label="Kết bạn"
        primary
        disabled={sendMutation.isPending}
        onPress={() => sendMutation.mutate()}
      />
    );
  } else if (status === "pending_sent") {
    text = "Đã gửi lời mời kết bạn";
    actions = (
      <BarButton
        label="Hủy lời mời"
        disabled={!sentRequestId || cancelMutation.isPending}
        onPress={() => sentRequestId && cancelMutation.mutate(sentRequestId)}
      />
    );
  } else if (status === "pending_received") {
    text = `${name} đã gửi lời mời kết bạn`;
    const disabled = !receivedRequestId || respondMutation.isPending;
    actions = (
      <>
        <BarButton
          label="Từ chối"
          disabled={disabled}
          onPress={() =>
            receivedRequestId &&
            respondMutation.mutate({
              requestId: receivedRequestId,
              action: "reject",
            })
          }
        />
        <BarButton
          label="Chấp nhận"
          primary
          disabled={disabled}
          onPress={() =>
            receivedRequestId &&
            respondMutation.mutate({
              requestId: receivedRequestId,
              action: "accept",
            })
          }
        />
      </>
    );
  } else {
    // Đã là bạn, đã chặn, hoặc profile không tải được (bị người kia chặn → 404).
    return null;
  }

  return (
    <View className="flex-row items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <Text
        numberOfLines={2}
        className="shrink text-sm text-zinc-700 dark:text-zinc-300"
      >
        {text}
      </Text>
      <View className="flex-row items-center gap-2">{actions}</View>
    </View>
  );
}
