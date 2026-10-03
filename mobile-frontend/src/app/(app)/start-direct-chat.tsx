import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, View } from "react-native";

import {
  Avatar,
  EmptyState,
  ErrorState,
  Header,
  ListRow,
} from "@/components/ui";
import { createDirectConversation } from "@/lib/conversations";
import { listFriends, type FriendItem } from "@/lib/friends";

export default function StartDirectChat() {
  const router = useRouter();

  const friendsQuery = useInfiniteQuery({
    queryKey: ["friends", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listFriends(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const friends = friendsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const createMutation = useMutation({
    mutationFn: (friendId: string) => createDirectConversation(friendId),
    onSuccess: (conv) => router.replace(`/conversation/${conv.id}`),
  });

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Nhắn tin" />

      {friendsQuery.isLoading ? null : friendsQuery.isError ? (
        <ErrorState onRetry={() => friendsQuery.refetch()} />
      ) : friends.length === 0 ? (
        <EmptyState title="Bạn chưa có bạn bè nào" icon="people-outline" />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item: FriendItem) => item.friendshipId}
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
              onPress={() => createMutation.mutate(item.user.id)}
              trailing={
                createMutation.isPending &&
                createMutation.variables === item.user.id ? (
                  <ActivityIndicator />
                ) : undefined
              }
            />
          )}
        />
      )}
    </View>
  );
}
