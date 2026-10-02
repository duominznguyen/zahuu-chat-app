import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Text, View } from "react-native";

import {
  Avatar,
  EmptyState,
  Header,
  ListRow,
  TextField,
} from "@/components/ui";
import { searchFriendsByName } from "@/lib/friends";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export default function SearchByName() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q.trim(), 300);
  const enabled = debouncedQ.length >= 1;

  const query = useQuery({
    queryKey: ["friends", "search", debouncedQ],
    queryFn: () => searchFriendsByName(debouncedQ),
    enabled,
  });

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Tìm trong bạn bè" />
      <View className="p-4">
        <TextField
          placeholder="Tên hiển thị"
          value={q}
          onChangeText={setQ}
          autoFocus
        />
      </View>

      {!enabled ? (
        <View className="items-center p-8">
          <Text className="text-zinc-400">Nhập tên để tìm trong bạn bè</Text>
        </View>
      ) : query.isLoading ? null : !query.data?.length ? (
        <EmptyState title="Không tìm thấy bạn bè nào" icon="search-outline" />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListRow
              leading={<Avatar name={item.displayName} uri={item.avatarUrl} />}
              title={item.displayName}
              subtitle={`@${item.username}`}
              onPress={() => router.push(`/user/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
