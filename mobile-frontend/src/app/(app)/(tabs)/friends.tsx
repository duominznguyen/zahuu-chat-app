import { Ionicons } from "@expo/vector-icons";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ActionSheet,
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  ListRow,
  confirm,
  useToast,
} from "@/components/ui";
import {
  blockUser,
  listFriendRequests,
  listFriends,
  unfriend,
  type FriendItem,
} from "@/lib/friends";

export default function FriendsTab() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<FriendItem | null>(null);

  const friendsQuery = useInfiniteQuery({
    queryKey: ["friends", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listFriends(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const receivedRequestsQuery = useQuery({
    queryKey: ["friend-requests", "received"],
    queryFn: () => listFriendRequests("received"),
  });

  const unfriendMutation = useMutation({
    mutationFn: (userId: string) => unfriend(userId),
    onSuccess: () => {
      toast.show("Đã hủy kết bạn");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const blockMutation = useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onSuccess: () => {
      toast.show("Đã chặn");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  const items = friendsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const pendingCount = receivedRequestsQuery.data?.length ?? 0;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-zinc-950">
      <View className="flex-row items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <Text className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Bạn bè
        </Text>
        <View className="flex-row gap-4">
          <Pressable onPress={() => setSearchSheetOpen(true)}>
            <Ionicons name="search" size={24} color="#71717a" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/friend-requests")}
            className="relative"
          >
            <Ionicons name="notifications-outline" size={24} color="#71717a" />
            {pendingCount > 0 && (
              <View className="absolute -right-1.5 -top-1.5">
                <Badge count={pendingCount} />
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {friendsQuery.isLoading ? null : friendsQuery.isError ? (
        <ErrorState onRetry={() => friendsQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có bạn bè nào"
          icon="people-outline"
          ctaLabel="Tìm bạn bè"
          onPressCta={() => setSearchSheetOpen(true)}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.friendshipId}
          onEndReached={() => {
            if (friendsQuery.hasNextPage) friendsQuery.fetchNextPage();
          }}
          renderItem={({ item }) => (
            <ListRow
              leading={
                <Avatar
                  name={item.user.displayName}
                  uri={item.user.avatarUrl}
                />
              }
              title={item.user.displayName}
              subtitle={`@${item.user.username}`}
              trailing={
                <Pressable onPress={() => setMenuTarget(item)} className="p-2">
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color="#a1a1aa"
                  />
                </Pressable>
              }
              onPress={() => router.push(`/user/${item.user.id}`)}
            />
          )}
        />
      )}

      <ActionSheet
        visible={searchSheetOpen}
        onClose={() => setSearchSheetOpen(false)}
        items={[
          {
            key: "username",
            label: "Tìm theo username",
            icon: "at-outline",
            onPress: () => router.push("/search-username"),
          },
          {
            key: "name",
            label: "Tìm trong bạn bè theo tên",
            icon: "people-outline",
            onPress: () => router.push("/search-by-name"),
          },
        ]}
      />

      <ActionSheet
        visible={!!menuTarget}
        onClose={() => setMenuTarget(null)}
        items={[
          {
            key: "unfriend",
            label: "Hủy kết bạn",
            icon: "person-remove-outline",
            destructive: true,
            onPress: async () => {
              if (!menuTarget) return;
              const ok = await confirm({
                title: "Hủy kết bạn?",
                message: `Bạn sẽ không còn là bạn bè với ${menuTarget.user.displayName}.`,
                destructive: true,
                confirmLabel: "Hủy kết bạn",
              });
              if (ok) unfriendMutation.mutate(menuTarget.user.id);
            },
          },
          {
            key: "block",
            label: "Chặn",
            icon: "ban-outline",
            destructive: true,
            onPress: async () => {
              if (!menuTarget) return;
              const ok = await confirm({
                title: "Chặn người này?",
                message: `${menuTarget.user.displayName} sẽ không thể liên hệ với bạn.`,
                destructive: true,
                confirmLabel: "Chặn",
              });
              if (ok) blockMutation.mutate(menuTarget.user.id);
            },
          },
        ]}
      />
    </SafeAreaView>
  );
}
