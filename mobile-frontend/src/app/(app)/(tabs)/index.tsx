import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ActionSheet,
  Avatar,
  Dot,
  EmptyState,
  ErrorState,
  ListRow,
} from "@/components/ui";
import {
  listConversations,
  type ConversationSummary,
} from "@/lib/conversations";
import { formatRelativeTime } from "@/lib/format-time";
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

// M9 (Realtime polish) sẽ thêm chấm online cho conversation DIRECT — backend
// chưa expose trạng thái online lúc load trang đầu (chỉ có qua socket), nên
// chưa làm ở milestone này để tránh hiện sai trạng thái lúc mới mở app.
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
    return () => {
      socket.off("message:new", refetch);
      socket.off("message:recalled", refetch);
      socket.off("group:memberAdded", refetch);
      socket.off("group:memberRemoved", refetch);
      socket.off("group:updated", refetch);
    };
  }, [socket, queryClient]);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-zinc-950">
      <View className="flex-row items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <Text className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Tin nhắn
        </Text>
        <Pressable onPress={() => setNewChatSheetOpen(true)}>
          <Ionicons name="add-circle-outline" size={28} color="#71717a" />
        </Pressable>
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
              leading={<Avatar name={item.name ?? "?"} uri={item.avatarUrl} />}
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
