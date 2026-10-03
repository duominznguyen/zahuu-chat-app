import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { FlatList, Text, View } from "react-native";

import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  ListRow,
  confirm,
  useToast,
} from "@/components/ui";
import {
  createInviteLink,
  listInviteLinks,
  revokeInviteLink,
  type InviteLink,
} from "@/lib/conversations";

function linkUrl(token: string) {
  return `zahuu://invite/${token}`;
}

export default function InviteLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: ["conversations", "invite-links", id],
    queryFn: () => listInviteLinks(id),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["conversations", "invite-links", id],
    });

  const createMutation = useMutation({
    mutationFn: () => createInviteLink(id),
    onSuccess: async (link) => {
      invalidate();
      await Clipboard.setStringAsync(linkUrl(link.token));
      toast.show("Đã tạo link mới và sao chép vào bộ nhớ tạm");
    },
    onError: () => toast.show("Tạo link thất bại, vui lòng thử lại"),
  });

  const revokeMutation = useMutation({
    mutationFn: (linkId: string) => revokeInviteLink(id, linkId),
    onSuccess: () => {
      toast.show("Đã thu hồi link");
      invalidate();
    },
    onError: () => toast.show("Thu hồi thất bại, vui lòng thử lại"),
  });

  const copyLink = async (token: string) => {
    await Clipboard.setStringAsync(linkUrl(token));
    toast.show("Đã sao chép link");
  };

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Link mời" />

      <View className="gap-2 p-4">
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
          Bất kỳ ai có link đều tham gia được, kể cả người lạ.
        </Text>
        <Button
          loading={createMutation.isPending}
          onPress={() => createMutation.mutate()}
        >
          Tạo link mới
        </Button>
      </View>

      {query.isLoading ? null : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState title="Chưa có link mời nào" icon="link-outline" />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(item: InviteLink) => item.id}
          renderItem={({ item }) => (
            <ListRow
              leading={
                <Ionicons name="link-outline" size={22} color="#71717a" />
              }
              title={linkUrl(item.token)}
              subtitle={`Tạo lúc ${new Date(item.createdAt).toLocaleString("vi-VN")}`}
              onPress={() => copyLink(item.token)}
              trailing={
                <View className="flex-row gap-2">
                  <Button
                    variant="secondary"
                    className="h-9 px-3"
                    onPress={() => copyLink(item.token)}
                  >
                    Copy
                  </Button>
                  <Button
                    variant="destructive"
                    className="h-9 px-3"
                    loading={
                      revokeMutation.isPending &&
                      revokeMutation.variables === item.id
                    }
                    onPress={async () => {
                      const ok = await confirm({
                        title: "Thu hồi link này?",
                        message: "Ai đang cầm link này sẽ không join được nữa.",
                        destructive: true,
                        confirmLabel: "Thu hồi",
                      });
                      if (ok) revokeMutation.mutate(item.id);
                    }}
                  >
                    Thu hồi
                  </Button>
                </View>
              }
            />
          )}
        />
      )}
    </View>
  );
}
