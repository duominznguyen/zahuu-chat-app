import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Keyboard, View } from "react-native";

import {
  Avatar,
  EmptyState,
  ErrorState,
  Header,
  ListRow,
  TextField,
} from "@/components/ui";
import { formatRelativeTime } from "@/lib/format-time";
import { searchMessages } from "@/lib/messages";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useJumpStore } from "@/store/jump-store";

export default function ConversationSearch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [text, setText] = useState("");
  const debounced = useDebouncedValue(text.trim(), 300);

  const query = useInfiniteQuery({
    queryKey: ["messages", "search", id, debounced],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      searchMessages(id, debounced, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: debounced.length > 0,
  });

  const hits = query.data?.pages.flatMap((p) => p.items) ?? [];

  // Về thẳng màn chat (bỏ qua màn Thông tin ở giữa), màn chat tự cuộn tới tin.
  const jumpTo = (messageId: string) => {
    Keyboard.dismiss();
    useJumpStore.getState().requestJump({ conversationId: id, messageId });
    router.dismissTo(`/conversation/${id}`);
  };

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Tìm kiếm tin nhắn" />
      <View className="p-4">
        <TextField
          placeholder="Nhập từ khoá"
          value={text}
          onChangeText={setText}
          accessibilityLabel="Từ khoá tìm kiếm"
          autoCapitalize="none"
          autoFocus
          returnKeyType="search"
        />
      </View>

      {debounced.length === 0 ? (
        <EmptyState
          title="Nhập từ khoá để tìm trong đoạn chat"
          icon="search-outline"
        />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : query.isLoading ? null : hits.length === 0 ? (
        <EmptyState title="Không có tin nhắn nào khớp" icon="search-outline" />
      ) : (
        <FlatList
          data={hits}
          keyExtractor={(hit) => hit.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          renderItem={({ item }) => (
            <ListRow
              leading={
                <Avatar
                  name={item.sender.displayName}
                  uri={item.sender.avatarUrl}
                />
              }
              title={item.content ?? ""}
              subtitle={`${item.sender.displayName} · ${formatRelativeTime(item.createdAt)}`}
              onPress={() => jumpTo(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}
