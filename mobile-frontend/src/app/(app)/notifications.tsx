import type { InfiniteData } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, View } from "react-native";

import {
  Avatar,
  Dot,
  EmptyState,
  ErrorState,
  Header,
  ListRow,
} from "@/components/ui";
import { formatRelativeTime } from "@/lib/format-time";
import {
  listNotifications,
  markNotificationRead,
  type AppNotification,
  type NotificationsPage,
} from "@/lib/notifications";

type NotificationsCache = InfiniteData<NotificationsPage, string | undefined>;

function notificationText(n: AppNotification) {
  const name = n.actor?.displayName ?? "Ai đó";
  switch (n.type) {
    case "FRIEND_REQUEST_RECEIVED":
      return `${name} đã gửi lời mời kết bạn`;
    case "FRIEND_REQUEST_ACCEPTED":
      return `${name} đã chấp nhận lời mời kết bạn`;
    case "GROUP_MEMBER_ADDED":
      return `${name} đã thêm bạn vào nhóm`;
  }
}

export default function Notifications() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["notifications", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      listNotifications(pageParam),
    // Luôn fetch mới mỗi lần mở màn — socket chỉ báo "có cái mới" (xem bump()
    // ở ChatsTab) chứ không tự cập nhật cache ở đây, vì record Notification
    // trong DB có thể ghi CHẬM HƠN chính sự kiện socket báo tới (2 việc chạy
    // song song không đồng bộ với nhau), invalidate ngay lúc đó dễ đọc phải
    // dữ liệu cũ hơn 1 nhịp (đã xảy ra thật khi test).
    staleTime: 0,
    gcTime: 0,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<NotificationsCache>(
        ["notifications", "list"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((n) =>
                n.id === id ? { ...n, isRead: true } : n,
              ),
            })),
          };
        },
      );
      queryClient.setQueryData<number>(["notifications", "unreadCount"], (c) =>
        Math.max(0, (c ?? 0) - 1),
      );
    },
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const handlePress = (n: AppNotification) => {
    if (!n.isRead) markReadMutation.mutate(n.id);
    switch (n.type) {
      case "FRIEND_REQUEST_RECEIVED":
        router.push("/friend-requests");
        return;
      case "FRIEND_REQUEST_ACCEPTED":
        if (n.actor) router.push(`/user/${n.actor.id}`);
        return;
      case "GROUP_MEMBER_ADDED":
        if (n.conversationId) router.push(`/conversation/${n.conversationId}`);
        return;
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Thông báo" />
      {query.isLoading ? null : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có thông báo nào"
          icon="notifications-outline"
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          onEndReached={() => {
            if (query.hasNextPage) query.fetchNextPage();
          }}
          renderItem={({ item }) => (
            <ListRow
              leading={
                <Avatar
                  name={item.actor?.displayName ?? "?"}
                  uri={item.actor?.avatarUrl}
                />
              }
              title={notificationText(item)}
              titleClassName={!item.isRead ? "font-semibold" : undefined}
              subtitle={formatRelativeTime(item.createdAt)}
              trailing={!item.isRead ? <Dot /> : undefined}
              onPress={() => handlePress(item)}
            />
          )}
        />
      )}
    </View>
  );
}
