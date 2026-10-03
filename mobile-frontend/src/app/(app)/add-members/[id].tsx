import { Ionicons } from "@expo/vector-icons";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";

import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Header,
  ListRow,
} from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { addMember, getConversationDetail } from "@/lib/conversations";
import { listFriends, type FriendItem } from "@/lib/friends";

type RowStatus = "pending" | "adding" | "added" | "error";

export default function AddMembers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", id],
    queryFn: () => getConversationDetail(id),
  });
  const existingMemberIds = new Set(
    detailQuery.data?.members.map((m) => m.id) ?? [],
  );

  const friendsQuery = useInfiniteQuery({
    queryKey: ["friends", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listFriends(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const candidates = (
    friendsQuery.data?.pages.flatMap((p) => p.items) ?? []
  ).filter((f) => !existingMemberIds.has(f.user.id));

  const toggle = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      setSubmitting(true);
      let hadError = false;
      // Bỏ qua người đã thêm thành công ở lần bấm trước (cho phép bấm lại để
      // retry riêng những người bị lỗi mà không gửi trùng request đã thành công).
      const targets = Array.from(selectedIds).filter(
        (userId) => statuses[userId] !== "added",
      );
      for (const userId of targets) {
        setStatuses((s) => ({ ...s, [userId]: "adding" }));
        try {
          await addMember(id, userId);
          setStatuses((s) => ({ ...s, [userId]: "added" }));
        } catch (e) {
          hadError = true;
          setStatuses((s) => ({ ...s, [userId]: "error" }));
          setErrors((er) => ({
            ...er,
            [userId]:
              e instanceof ApiError
                ? e.message
                : "Thêm thất bại, vui lòng thử lại",
          }));
        }
      }
      return { hadError };
    },
    onSettled: () => {
      setSubmitting(false);
      queryClient.invalidateQueries({
        queryKey: ["conversations", "detail", id],
      });
    },
  });

  const selectedCount = selectedIds.size;
  const canSubmit = selectedCount > 0 && !submitting;

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Thêm thành viên" />

      {friendsQuery.isLoading ||
      detailQuery.isLoading ? null : friendsQuery.isError ? (
        <ErrorState onRetry={() => friendsQuery.refetch()} />
      ) : candidates.length === 0 ? (
        <EmptyState
          title="Không còn bạn bè nào để thêm"
          icon="person-add-outline"
        />
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item: FriendItem) => item.friendshipId}
          onEndReached={() => {
            if (friendsQuery.hasNextPage) friendsQuery.fetchNextPage();
          }}
          renderItem={({ item }) => {
            const status = statuses[item.user.id] ?? "pending";
            const checked = selectedIds.has(item.user.id);
            return (
              <View>
                <ListRow
                  leading={
                    <Avatar
                      name={item.user.displayName}
                      uri={item.user.avatarUrl}
                    />
                  }
                  title={item.user.displayName}
                  subtitle={`@${item.user.username}`}
                  onPress={() => status === "pending" && toggle(item.user.id)}
                  trailing={
                    status === "adding" ? (
                      <ActivityIndicator />
                    ) : status === "added" ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#16A34A"
                      />
                    ) : status === "error" ? (
                      <Ionicons name="alert-circle" size={24} color="#DC2626" />
                    ) : (
                      <Pressable
                        onPress={() => toggle(item.user.id)}
                        className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                          checked
                            ? "border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      >
                        {checked && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </Pressable>
                    )
                  }
                />
                {status === "error" && errors[item.user.id] && (
                  <Text className="-mt-1 px-4 pb-2 text-xs text-danger dark:text-danger-dark">
                    {errors[item.user.id]}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}

      <View className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <Button
          loading={submitting}
          disabled={!canSubmit}
          onPress={async () => {
            const { hadError } = await addMutation.mutateAsync();
            // Còn ít nhất 1 người thất bại -> ở lại màn để người dùng thấy rõ
            // lỗi của từng người (chỉ tự quay lại khi thêm thành công hết).
            if (!hadError) router.back();
          }}
        >
          {selectedCount > 0 ? `Thêm (${selectedCount})` : "Thêm"}
        </Button>
      </View>
    </View>
  );
}
