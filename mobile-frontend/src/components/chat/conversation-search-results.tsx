import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Text,
  View,
} from "react-native";

import {
  Avatar,
  EmptyState,
  ErrorState,
  ListRow,
  useToast,
} from "@/components/ui";
import { ApiError, errorCodeOf } from "@/lib/api-client";
import {
  createDirectConversation,
  searchConversations,
  type ConversationSearchResult,
} from "@/lib/conversations";
import {
  listFriends,
  searchFriendsByName,
  searchUsersByUsername,
  type PublicUser,
} from "@/lib/friends";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type Row =
  | { kind: "label"; key: string; text: string }
  | { kind: "user"; key: string; user: PublicUser }
  | {
      kind: "group";
      key: string;
      group: ConversationSearchResult["groups"][number];
    }
  | {
      kind: "stranger";
      key: string;
      chat: ConversationSearchResult["directs"][number];
    };

function openChatErrorMessage(err: unknown) {
  if (errorCodeOf(err) === "BLOCKED_BY_YOU") {
    return "Bạn đã chặn người này, hãy bỏ chặn trước khi nhắn tin";
  }
  if (err instanceof ApiError && err.status === 404) {
    return "Không tìm thấy người dùng";
  }
  return "Không mở được đoạn chat, vui lòng thử lại";
}

const label = (text: string): Row => ({
  kind: "label",
  key: `label:${text}`,
  text,
});
const userRows = (users: PublicUser[], prefix: string): Row[] =>
  users.map((user) => ({ kind: "user", key: `${prefix}:${user.id}`, user }));

// Ô trống → danh sách bạn bè; gõ chữ thường → bạn bè theo tên + nhóm + chat 1-1
// với người chưa kết bạn đang có; gõ @ → tìm username công khai (cả người lạ).
export function ConversationSearchResults({
  searchText,
  onPicked,
}: {
  searchText: string;
  onPicked: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const debounced = useDebouncedValue(searchText.trim(), 300);
  const isUsernameMode = debounced.startsWith("@");
  const usernameQuery = isUsernameMode ? debounced.slice(1) : "";
  const nameQuery = isUsernameMode ? "" : debounced;

  const friendsQuery = useInfiniteQuery({
    queryKey: ["friends", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listFriends(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: debounced.length === 0,
  });

  // ≥3 ký tự sau @ khớp giới hạn/rate limit của backend.
  const usernameSearchQuery = useQuery({
    queryKey: ["users", "search", usernameQuery],
    queryFn: () => searchUsersByUsername(usernameQuery),
    enabled: isUsernameMode && usernameQuery.length >= 3,
  });

  const nameSearchQuery = useQuery({
    queryKey: ["friends", "search", nameQuery],
    queryFn: () => searchFriendsByName(nameQuery),
    enabled: nameQuery.length >= 1,
  });

  const conversationSearchQuery = useQuery({
    queryKey: ["conversations", "search", nameQuery],
    queryFn: () => searchConversations(nameQuery),
    enabled: nameQuery.length >= 1,
  });

  const openConversation = (conversationId: string) => {
    Keyboard.dismiss();
    onPicked();
    router.push(`/conversation/${conversationId}`);
  };

  // Tạo (hoặc lấy lại) chat 1-1 — người lạ cũng nhắn được, conversation chỉ
  // hiện trong danh sách của cả 2 sau tin nhắn đầu tiên.
  const openChatMutation = useMutation({
    mutationFn: (user: PublicUser) => createDirectConversation(user.id),
    onSuccess: (conv) => openConversation(conv.id),
    onError: (err) => toast.show(openChatErrorMessage(err)),
  });

  if (isUsernameMode && usernameQuery.length < 3) {
    return (
      <Text className="p-6 text-center text-sm text-zinc-400">
        Nhập ít nhất 3 ký tự sau @ để tìm
      </Text>
    );
  }

  let rows: Row[];
  let emptyTitle: string;
  let onEndReached: (() => void) | undefined;

  if (isUsernameMode) {
    if (usernameSearchQuery.isLoading) return null;
    if (usernameSearchQuery.isError) {
      return <ErrorState onRetry={() => usernameSearchQuery.refetch()} />;
    }
    rows = userRows(usernameSearchQuery.data ?? [], "username");
    emptyTitle = "Không tìm thấy ai";
  } else if (nameQuery) {
    if (nameSearchQuery.isLoading || conversationSearchQuery.isLoading) {
      return null;
    }
    if (nameSearchQuery.isError || conversationSearchQuery.isError) {
      return (
        <ErrorState
          onRetry={() => {
            void nameSearchQuery.refetch();
            void conversationSearchQuery.refetch();
          }}
        />
      );
    }
    const friends = nameSearchQuery.data ?? [];
    const groups = conversationSearchQuery.data?.groups ?? [];
    const strangers = conversationSearchQuery.data?.directs ?? [];
    rows = [
      ...(friends.length
        ? [label("Bạn bè"), ...userRows(friends, "friend")]
        : []),
      ...(groups.length
        ? [
            label("Nhóm"),
            ...groups.map((group): Row => ({
              kind: "group",
              key: `group:${group.id}`,
              group,
            })),
          ]
        : []),
      ...(strangers.length
        ? [
            label("Người chưa kết bạn"),
            ...strangers.map((chat): Row => ({
              kind: "stranger",
              key: `stranger:${chat.id}`,
              chat,
            })),
          ]
        : []),
    ];
    emptyTitle =
      "Không tìm thấy đoạn chat nào. Gõ @username để tìm người chưa kết bạn";
  } else {
    if (friendsQuery.isLoading) return null;
    if (friendsQuery.isError) {
      return <ErrorState onRetry={() => friendsQuery.refetch()} />;
    }
    const friends = friendsQuery.data?.pages.flatMap((p) => p.items) ?? [];
    rows = friends.length
      ? [
          label("Bạn bè"),
          ...userRows(
            friends.map((f) => f.user),
            "friend",
          ),
        ]
      : [];
    emptyTitle = "Chưa có bạn bè nào. Gõ @username để tìm người khác";
    onEndReached = () => {
      if (friendsQuery.hasNextPage && !friendsQuery.isFetchingNextPage) {
        void friendsQuery.fetchNextPage();
      }
    };
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} icon="search-outline" />;
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      // Bàn phím đang mở thì lần chạm đầu vào kết quả phải được xử lý ngay,
      // không bị nuốt để chỉ đóng bàn phím.
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onEndReached={onEndReached}
      renderItem={({ item }) => {
        switch (item.kind) {
          case "label":
            return (
              <Text className="px-4 pb-1 pt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {item.text}
              </Text>
            );
          case "user": {
            const pending =
              openChatMutation.isPending &&
              openChatMutation.variables?.id === item.user.id;
            return (
              <ListRow
                leading={
                  <Avatar
                    name={item.user.displayName}
                    uri={item.user.avatarUrl}
                  />
                }
                title={item.user.displayName}
                subtitle={`@${item.user.username}`}
                trailing={pending ? <ActivityIndicator /> : undefined}
                onPress={() => {
                  if (!openChatMutation.isPending)
                    openChatMutation.mutate(item.user);
                }}
              />
            );
          }
          case "group":
            return (
              <ListRow
                leading={
                  <Avatar
                    name={item.group.name ?? "?"}
                    uri={item.group.avatarUrl}
                  />
                }
                title={item.group.name ?? "Nhóm"}
                subtitle={`${item.group.memberCount} thành viên`}
                onPress={() => openConversation(item.group.id)}
              />
            );
          case "stranger":
            return (
              <ListRow
                leading={
                  <Avatar name={item.chat.name} uri={item.chat.avatarUrl} />
                }
                title={item.chat.name}
                subtitle={`@${item.chat.otherUser.username}`}
                onPress={() => openConversation(item.chat.id)}
              />
            );
        }
      }}
      ListFooterComponent={<View className="h-4" />}
    />
  );
}
