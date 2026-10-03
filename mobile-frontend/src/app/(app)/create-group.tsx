import { Ionicons } from "@expo/vector-icons";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Header,
  ListRow,
  TextField,
  useToast,
} from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { createGroupConversation } from "@/lib/conversations";
import { listFriends, type FriendItem } from "@/lib/friends";

const MAX_MEMBERS = 250;

export default function CreateGroup() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const friendsQuery = useInfiniteQuery({
    queryKey: ["friends", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listFriends(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const friends = friendsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      createGroupConversation(name.trim(), Array.from(selectedIds)),
    onSuccess: (conv) => {
      // Không chờ socket group:memberAdded round-trip cho chính hành động của
      // mình — tự invalidate ngay, đơn giản và chắc chắn hơn.
      queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
      router.replace(`/conversation/${conv.id}`);
    },
    onError: (e) => {
      toast.show(
        e instanceof ApiError
          ? e.message
          : "Tạo nhóm thất bại, vui lòng thử lại",
      );
    },
  });

  const toggle = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else if (next.size < MAX_MEMBERS) next.add(userId);
      return next;
    });
  };

  const canSubmit =
    name.trim().length > 0 && selectedIds.size > 0 && !createMutation.isPending;

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Tạo nhóm" />
      <View className="gap-2 p-4">
        <TextField
          label="Tên nhóm"
          value={name}
          onChangeText={setName}
          maxLength={100}
          placeholder="Nhập tên nhóm"
        />
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
          Đã chọn {selectedIds.size}/{MAX_MEMBERS} thành viên
        </Text>
      </View>

      {friendsQuery.isLoading ? null : friendsQuery.isError ? (
        <ErrorState onRetry={() => friendsQuery.refetch()} />
      ) : friends.length === 0 ? (
        <EmptyState
          title="Bạn chưa có bạn bè nào để thêm"
          icon="people-outline"
        />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item: FriendItem) => item.friendshipId}
          onEndReached={() => {
            if (friendsQuery.hasNextPage) friendsQuery.fetchNextPage();
          }}
          renderItem={({ item }) => {
            const checked = selectedIds.has(item.user.id);
            const disabled = !checked && selectedIds.size >= MAX_MEMBERS;
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
                onPress={() => !disabled && toggle(item.user.id)}
                trailing={
                  <Pressable
                    disabled={disabled}
                    onPress={() => toggle(item.user.id)}
                    className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                      checked
                        ? "border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark"
                        : "border-zinc-300 dark:border-zinc-700"
                    } ${disabled ? "opacity-40" : ""}`}
                  >
                    {checked && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </Pressable>
                }
              />
            );
          }}
        />
      )}

      <View className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <Button
          loading={createMutation.isPending}
          disabled={!canSubmit}
          onPress={() => createMutation.mutate()}
        >
          Tạo nhóm
        </Button>
      </View>
    </View>
  );
}
