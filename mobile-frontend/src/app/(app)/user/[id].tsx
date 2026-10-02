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
import { createDirectConversation } from "@/lib/conversations";
import {
  blockUser,
  getUserProfile,
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

  const sendRequestMutation = useMutation({
    mutationFn: () => sendFriendRequest(id),
    onSuccess: () => {
      toast.show("Đã gửi lời mời kết bạn");
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
  const status = user.relationshipStatus;

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
              <>
                <Button
                  loading={messageMutation.isPending}
                  onPress={() => messageMutation.mutate()}
                >
                  Nhắn tin
                </Button>
                <Button variant="secondary" onPress={() => setMenuOpen(true)}>
                  Thêm tùy chọn
                </Button>
              </>
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
              <Button disabled>Đã gửi lời mời</Button>
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
          </View>
        </View>
      </ScrollView>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          {
            key: "unfriend",
            label: "Hủy kết bạn",
            icon: "person-remove-outline",
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
        ]}
      />
    </View>
  );
}
