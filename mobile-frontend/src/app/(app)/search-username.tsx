import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Text, View } from "react-native";

import {
  Avatar,
  Button,
  EmptyState,
  Header,
  ListRow,
  TextField,
} from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import {
  searchUsersByUsername,
  sendFriendRequest,
  type PublicUser,
} from "@/lib/friends";
import { useDebouncedValue } from "@/lib/use-debounced-value";

function ResultRow({ user }: { user: PublicUser }) {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => sendFriendRequest(user.id),
  });

  const alreadyFriends =
    mutation.error instanceof ApiError &&
    (mutation.error.body as { code?: string })?.code === "ALREADY_FRIENDS";
  const alreadySent =
    mutation.error instanceof ApiError &&
    (mutation.error.body as { code?: string })?.code === "REQUEST_ALREADY_SENT";

  let buttonLabel = "Kết bạn";
  let disabled = false;
  if (mutation.isSuccess || alreadySent) {
    buttonLabel = "Đã gửi lời mời";
    disabled = true;
  } else if (alreadyFriends) {
    buttonLabel = "Đã là bạn bè";
    disabled = true;
  }

  return (
    <ListRow
      leading={<Avatar name={user.displayName} uri={user.avatarUrl} />}
      title={user.displayName}
      subtitle={`@${user.username}`}
      onPress={() => router.push(`/user/${user.id}`)}
      trailing={
        <Button
          variant="secondary"
          className="h-9 px-3"
          disabled={disabled}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        >
          {buttonLabel}
        </Button>
      }
    />
  );
}

export default function SearchUsername() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q.trim(), 300);
  const enabled = debouncedQ.length >= 3;

  const query = useQuery({
    queryKey: ["users", "search", debouncedQ],
    queryFn: () => searchUsersByUsername(debouncedQ),
    enabled,
  });

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Tìm theo username" />
      <View className="p-4">
        <TextField
          placeholder="@username"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoFocus
        />
      </View>

      {!enabled ? (
        <View className="items-center p-8">
          <Text className="text-zinc-400">Nhập ít nhất 3 ký tự để tìm</Text>
        </View>
      ) : query.isLoading ? null : !query.data?.length ? (
        <EmptyState title="Không tìm thấy ai" icon="search-outline" />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ResultRow user={item} />}
        />
      )}
    </View>
  );
}
