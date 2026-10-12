import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  ActionSheet,
  Avatar,
  Button,
  ErrorState,
  Header,
  confirm,
  useToast,
} from "@/components/ui";
import type { ActionSheetItem } from "@/components/ui/action-sheet";
import { createDirectConversation } from "@/lib/conversations";
import {
  blockUser,
  cancelFriendRequest,
  getUserProfile,
  listFriendRequests,
  sendFriendRequest,
  unblockUser,
  unfriend,
} from "@/lib/friends";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const query = useQuery({
    queryKey: ["users", "profile", id],
    queryFn: () => getUserProfile(id),
  });

  useEffect(() => {
    if (query.data?.relationshipStatus === "self")
      router.replace("/(tabs)/me" as never);
  }, [query.data?.relationshipStatus, router]);

  const invalidateProfile = () => {
    queryClient.invalidateQueries({ queryKey: ["users", "profile", id] });
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
  };

  // Profile không trả id lời mời — tra trong danh sách đã gửi để huỷ đúng lời mời.
  const status = query.data?.relationshipStatus;
  const sentQuery = useQuery({
    queryKey: ["friend-requests", "sent"],
    queryFn: () => listFriendRequests("sent"),
    enabled: status === "pending_sent",
  });
  const sentRequestId = sentQuery.data?.find((r) => r.user.id === id)?.id;

  // Lỗi thường do trạng thái đang hiển thị đã cũ (vd người kia vừa gửi lời
  // mời/vừa chặn) — tải lại để màn tự đúng thay vì im lặng.
  const sendRequestMutation = useMutation({
    mutationFn: () => sendFriendRequest(id),
    onSuccess: (res) => {
      toast.show(
        res.status === "accepted"
          ? "Hai bạn đã là bạn bè"
          : "Đã gửi lời mời kết bạn",
      );
      invalidateProfile();
    },
    onError: () => {
      toast.show("Gửi lời mời thất bại, vui lòng thử lại");
      invalidateProfile();
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: (requestId: string) => cancelFriendRequest(requestId),
    onSuccess: () => {
      toast.show("Đã hủy lời mời kết bạn");
      invalidateProfile();
    },
    onError: () => {
      toast.show("Hủy lời mời thất bại, vui lòng thử lại");
      invalidateProfile();
    },
  });

  const unfriendMutation = useMutation({
    mutationFn: () => unfriend(id),
    onSuccess: () => {
      toast.show("Đã hủy kết bạn");
      invalidateProfile();
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => blockUser(id),
    onSuccess: () => {
      toast.show("Đã chặn");
      invalidateProfile();
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(id),
    onSuccess: () => {
      toast.show("Đã bỏ chặn");
      invalidateProfile();
    },
  });

  const messageMutation = useMutation({
    mutationFn: () => createDirectConversation(id),
    onSuccess: (conv) => {
      router.push(`/conversation/${conv.id}`);
    },
  });

  if (query.isLoading)
    return <View className="flex-1 bg-white dark:bg-zinc-950" />;
  if (query.isError || !query.data) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <Header title="Hồ sơ" />
        <ErrorState onRetry={() => query.refetch()} />
      </View>
    );
  }

  const user = query.data;

  const menuItems: ActionSheetItem[] = [
    ...(status === "friends"
      ? [
          {
            key: "unfriend",
            label: "Hủy kết bạn",
            icon: "person-remove-outline" as const,
            destructive: true,
            onPress: async () => {
              const ok = await confirm({
                title: "Hủy kết bạn?",
                destructive: true,
                confirmLabel: "Hủy kết bạn",
              });
              if (ok) unfriendMutation.mutate();
            },
          },
        ]
      : []),
    // Chặn được cả người lạ (vd người nhắn tin tới qua @username), không chỉ bạn bè.
    {
      key: "block",
      label: "Chặn",
      icon: "ban-outline",
      destructive: true,
      onPress: async () => {
        const ok = await confirm({
          title: "Chặn người này?",
          destructive: true,
          confirmLabel: "Chặn",
        });
        if (ok) blockMutation.mutate();
      },
    },
  ];

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Hồ sơ" />
      <ScrollView>
        <View className="items-center gap-3 p-6">
          <Avatar name={user.displayName} uri={user.avatarUrl} size={96} />
          <View className="items-center gap-1">
            <Text className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {user.displayName}
            </Text>
            <Text className="text-zinc-500 dark:text-zinc-400">
              @{user.username}
            </Text>
          </View>
          {user.bio && (
            <Text className="text-center text-zinc-600 dark:text-zinc-300">
              {user.bio}
            </Text>
          )}
          {user.birthday && (
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              Sinh ngày {new Date(user.birthday).toLocaleDateString("vi-VN")}
            </Text>
          )}
          {user.gender && (
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              {GENDER_LABEL[user.gender] ?? user.gender}
            </Text>
          )}

          <View className="w-full gap-3 pt-4">
            {status === "friends" && (
              <Button
                loading={messageMutation.isPending}
                onPress={() => messageMutation.mutate()}
              >
                Nhắn tin
              </Button>
            )}

            {status === "none" && (
              <Button
                loading={sendRequestMutation.isPending}
                onPress={() => sendRequestMutation.mutate()}
              >
                Kết bạn
              </Button>
            )}

            {status === "pending_sent" && (
              <>
                <Text className="text-center text-zinc-500 dark:text-zinc-400">
                  Đã gửi lời mời kết bạn
                </Text>
                <Button
                  variant="secondary"
                  disabled={!sentRequestId}
                  loading={cancelRequestMutation.isPending}
                  onPress={() =>
                    sentRequestId && cancelRequestMutation.mutate(sentRequestId)
                  }
                >
                  Hủy lời mời
                </Button>
              </>
            )}

            {status === "pending_received" && (
              <>
                <Text className="text-center text-zinc-500 dark:text-zinc-400">
                  {user.displayName} đã gửi cho bạn lời mời kết bạn
                </Text>
                <Button onPress={() => router.push("/friend-requests")}>
                  Xem lời mời kết bạn
                </Button>
              </>
            )}

            {status === "blocked" && (
              <Button
                variant="secondary"
                loading={unblockMutation.isPending}
                onPress={async () => {
                  const ok = await confirm({ title: "Bỏ chặn?" });
                  if (ok) unblockMutation.mutate();
                }}
              >
                Bỏ chặn
              </Button>
            )}

            {status !== "blocked" && (
              <Button variant="secondary" onPress={() => setMenuOpen(true)}>
                Thêm tùy chọn
              </Button>
            )}
          </View>
        </View>
      </ScrollView>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
      />
    </View>
  );
}
