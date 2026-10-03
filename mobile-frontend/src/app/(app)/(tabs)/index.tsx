import { Ionicons } from "@expo/vector-icons";
import type { InfiniteData } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ActionSheet,
  Avatar,
  Badge,
  Dot,
  EmptyState,
  ErrorState,
  ListRow,
} from "@/components/ui";
import {
  listConversations,
  type ConversationsPage,
  type ConversationSummary,
} from "@/lib/conversations";
import { formatRelativeTime } from "@/lib/format-time";
import { listNotifications } from "@/lib/notifications";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";

const MEDIA_LABEL: Record<string, string> = {
  IMAGE: "ảnh",
  VIDEO: "video",
  FILE: "file",
  STICKER: "sticker",
};

function previewText(c: ConversationSummary, myId: string | undefined) {
  if (!c.lastMessage) return "Hãy bắt đầu trò chuyện";
  if (c.lastMessage.isRecalled) return "Tin nhắn đã thu hồi";
  const prefix = c.lastMessage.senderId === myId ? "Bạn: " : "";
  if (c.lastMessage.type !== "TEXT") {
    return `${prefix}Đã gửi 1 ${MEDIA_LABEL[c.lastMessage.type]}`;
  }
  return `${prefix}${c.lastMessage.content ?? ""}`;
}

type ConversationsCache = InfiniteData<ConversationsPage, string | undefined>;

function patchOnlineStatus(
  data: ConversationsCache | undefined,
  userId: string,
  isOnline: boolean,
): ConversationsCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((c) =>
        c.otherUser?.id === userId
          ? { ...c, otherUser: { ...c.otherUser, isOnline } }
          : c,
      ),
    })),
  };
}

export default function ChatsTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const myId = useAuthStore((s) => s.user?.id);
  const [newChatSheetOpen, setNewChatSheetOpen] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ["conversations", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      listConversations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  useEffect(() => {
    if (!socket) return;
    // Đơn giản hoá: có tin mới/thu hồi thì refetch lại cả list thay vì tự vá
    // cache từng item — list này không đổi liên tục nên chấp nhận phí 1 request.
    const refetch = () =>
      queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
    socket.on("message:new", refetch);
    socket.on("message:recalled", refetch);
    // memberAdded cũng bắn cho chính người tạo group/direct mới (xem CLAUDE.md
    // mục kiến trúc realtime) -> list phải refetch ngay, không đợi tin nhắn đầu.
    socket.on("group:memberAdded", refetch);
    socket.on("group:memberRemoved", refetch);
    socket.on("group:updated", refetch);

    const onPresence = ({
      userId,
      isOnline,
    }: {
      userId: string;
      isOnline: boolean;
    }) => {
      queryClient.setQueryData<ConversationsCache>(
        ["conversations", "list"],
        (old) => patchOnlineStatus(old, userId, isOnline),
      );
    };
    socket.on("presence:update", onPresence);

    return () => {
      socket.off("message:new", refetch);
      socket.off("message:recalled", refetch);
      socket.off("group:memberAdded", refetch);
      socket.off("group:memberRemoved", refetch);
      socket.off("group:updated", refetch);
      socket.off("presence:update", onPresence);
    };
  }, [socket, queryClient]);

  // Không có endpoint đếm riêng -> khởi tạo bằng cách đếm isRead:false trong
  // trang đầu GET /notifications, rồi tự cộng/trừ qua socket trong lúc app mở.
  // Không chính xác tuyệt đối nếu offline lâu rồi online lại (chấp nhận được,
  // mở màn Notifications sẽ refetch ra số đúng).
  const unreadCountQuery = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: async () => {
      const page = await listNotifications();
      return page.items.filter((n) => !n.isRead).length;
    },
  });

  useEffect(() => {
    if (!socket) return;
    // Chỉ cộng dồn SỐ ngay (không phụ thuộc fetch nào) — không tự invalidate
    // danh sách Thông báo tại đây: event socket này tới có thể NHANH HƠN chính
    // transaction tạo `Notification` DB (2 việc chạy song song, không đồng bộ
    // với nhau — xem NotificationsService/ChatGateway, cùng lắng nghe 1 event
    // nhưng độc lập), nên invalidate+refetch ngay lúc này có thể đọc phải dữ
    // liệu CŨ (đã xảy ra thật khi test). Màn Notifications tự đặt `staleTime: 0`
    // để luôn fetch mới mỗi lần mở, đó mới là lúc chắc chắn DB đã ghi xong.
    const bump = () =>
      queryClient.setQueryData<number>(
        ["notifications", "unreadCount"],
        (c) => (c ?? 0) + 1,
      );
    // group:memberAdded còn bắn lúc tạo DIRECT/GROUP mới (chỉ để tự join room,
    // không phải thông báo thật) -> phải lọc đúng theo cờ notify server gửi kèm,
    // không thể tự suy ra chỉ từ việc member.id trùng mình.
    const onGroupMemberAdded = ({
      member,
      notify,
    }: {
      member: { id: string };
      notify: boolean;
    }) => {
      if (notify && member.id === myId) bump();
    };
    socket.on("friend:requestReceived", bump);
    socket.on("friend:accepted", bump);
    socket.on("group:memberAdded", onGroupMemberAdded);
    return () => {
      socket.off("friend:requestReceived", bump);
      socket.off("friend:accepted", bump);
      socket.off("group:memberAdded", onGroupMemberAdded);
    };
  }, [socket, queryClient, myId]);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-zinc-950">
      <View className="flex-row items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <Text className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Tin nhắn
        </Text>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.push("/notifications")}>
            <View>
              <Ionicons
                name="notifications-outline"
                size={26}
                color="#71717a"
              />
              {!!unreadCountQuery.data && (
                <View className="absolute -right-1.5 -top-1.5">
                  <Badge count={unreadCountQuery.data} />
                </View>
              )}
            </View>
          </Pressable>
          <Pressable onPress={() => setNewChatSheetOpen(true)}>
            <Ionicons name="add-circle-outline" size={28} color="#71717a" />
          </Pressable>
        </View>
      </View>

      {query.isLoading ? null : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="Chưa có cuộc trò chuyện nào" />
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
                  name={item.name ?? "?"}
                  uri={item.avatarUrl}
                  online={item.otherUser?.isOnline}
                />
              }
              title={item.name ?? "Người dùng đã xóa"}
              titleClassName={item.unread ? "font-semibold" : undefined}
              subtitle={previewText(item, myId)}
              subtitleClassName={
                item.unread
                  ? "font-medium text-zinc-700 dark:text-zinc-200"
                  : undefined
              }
              trailing={
                <View className="items-end gap-1.5">
                  {item.lastMessageAt && (
                    <Text className="text-xs text-zinc-400">
                      {formatRelativeTime(item.lastMessageAt)}
                    </Text>
                  )}
                  {item.unread && <Dot />}
                </View>
              }
              onPress={() => router.push(`/conversation/${item.id}`)}
            />
          )}
        />
      )}

      <ActionSheet
        visible={newChatSheetOpen}
        onClose={() => setNewChatSheetOpen(false)}
        items={[
          {
            key: "direct",
            label: "Nhắn tin",
            icon: "person-outline",
            onPress: () => router.push("/start-direct-chat"),
          },
          {
            key: "group",
            label: "Tạo nhóm",
            icon: "people-outline",
            onPress: () => router.push("/create-group"),
          },
        ]}
      />
    </SafeAreaView>
  );
}
