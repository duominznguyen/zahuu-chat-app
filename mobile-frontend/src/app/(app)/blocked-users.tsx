import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, View } from "react-native";

import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Header,
  ListRow,
  confirm,
  useToast,
} from "@/components/ui";
import { listBlocked, unblockUser } from "@/lib/friends";

export default function BlockedUsers() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["blocks"],
    queryFn: listBlocked,
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => {
      toast.show("Đã bỏ chặn");
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Danh sách chặn" />

      {query.isLoading ? null : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState title="Chưa chặn ai" icon="ban-outline" />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListRow
              leading={<Avatar name={item.displayName} uri={item.avatarUrl} />}
              title={item.displayName}
              subtitle={`@${item.username}`}
              trailing={
                <Button
                  variant="secondary"
                  className="h-9 px-3"
                  loading={
                    unblockMutation.isPending &&
                    unblockMutation.variables === item.id
                  }
                  onPress={async () => {
                    const ok = await confirm({
                      title: "Bỏ chặn?",
                      message: `${item.displayName} sẽ có thể tìm và kết bạn với bạn lại.`,
                    });
                    if (ok) unblockMutation.mutate(item.id);
                  }}
                >
                  Bỏ chặn
                </Button>
              }
            />
          )}
        />
      )}
    </View>
  );
}
