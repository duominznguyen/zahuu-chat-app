import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Header,
  ListRow,
  useToast,
} from "@/components/ui";
import {
  cancelFriendRequest,
  listFriendRequests,
  respondFriendRequest,
  type FriendRequestItem,
} from "@/lib/friends";

type Tab = "received" | "sent";

export default function FriendRequests() {
  const [tab, setTab] = useState<Tab>("received");
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["friend-requests", tab],
    queryFn: () => listFriendRequests(tab),
  });

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ["friend-requests"] });

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "reject" }) =>
      respondFriendRequest(id, action),
    onSuccess: (_res, { action }) => {
      toast.show(
        action === "accept" ? "Đã chấp nhận lời mời" : "Đã từ chối lời mời",
      );
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelFriendRequest(id),
    onSuccess: () => {
      toast.show("Đã hủy lời mời");
      invalidateAll();
    },
  });

  const renderItem = ({ item }: { item: FriendRequestItem }) => (
    <ListRow
      leading={
        <Avatar name={item.user.displayName} uri={item.user.avatarUrl} />
      }
      title={item.user.displayName}
      subtitle={`@${item.user.username}`}
      trailing={
        tab === "received" ? (
          <View className="flex-row gap-2">
            <Button
              variant="secondary"
              className="h-9 px-3"
              loading={
                respondMutation.isPending &&
                respondMutation.variables?.id === item.id
              }
              onPress={() =>
                respondMutation.mutate({ id: item.id, action: "reject" })
              }
            >
              Từ chối
            </Button>
            <Button
              className="h-9 px-3"
              loading={
                respondMutation.isPending &&
                respondMutation.variables?.id === item.id
              }
              onPress={() =>
                respondMutation.mutate({ id: item.id, action: "accept" })
              }
            >
              Chấp nhận
            </Button>
          </View>
        ) : (
          <Button
            variant="secondary"
            className="h-9 px-3"
            loading={
              cancelMutation.isPending && cancelMutation.variables === item.id
            }
            onPress={() => cancelMutation.mutate(item.id)}
          >
            Hủy
          </Button>
        )
      }
    />
  );

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Lời mời kết bạn" />
      <View className="flex-row gap-2 p-4">
        {(["received", "sent"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 items-center rounded-xl py-2.5 ${
              tab === t
                ? "bg-primary dark:bg-primary-dark"
                : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            <Text
              className={`font-medium ${
                tab === t
                  ? "text-white dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {t === "received" ? "Đã nhận" : "Đã gửi"}
            </Text>
          </Pressable>
        ))}
      </View>

      {query.isLoading ? null : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState
          title={
            tab === "received"
              ? "Chưa có lời mời nào"
              : "Bạn chưa gửi lời mời nào"
          }
          icon="mail-outline"
        />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}
