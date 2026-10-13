import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import {
  EmptyState,
  ErrorState,
  Header,
  ListRow,
  useToast,
} from "@/components/ui";
import { formatRelativeTime } from "@/lib/format-time";
import { downloadAndShare, videoPosterUrl } from "@/lib/media";
import { listMediaMessages, type Message } from "@/lib/messages";

type Kind = "MEDIA" | "FILE";

const COLUMNS = 3;
const GAP = 2;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function KindTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-1 items-center rounded-xl py-2 ${
        active
          ? "bg-primary dark:bg-primary-dark"
          : "bg-zinc-100 dark:bg-zinc-800"
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          active
            ? "text-white dark:text-zinc-900"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ConversationMedia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<Kind>("MEDIA");

  const query = useInfiniteQuery({
    queryKey: ["messages", "media", id, kind],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      listMediaMessages(id, kind, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items: Message[] = query.data?.pages.flatMap((p) => p.items) ?? [];
  const tileSize = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  };

  const openFile = async (url: string) => {
    try {
      await downloadAndShare(url);
    } catch {
      toast.show("Mở file thất bại, vui lòng thử lại");
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="File phương tiện và file" />
      <View className="flex-row gap-2 p-3">
        <KindTab
          label="Ảnh/Video"
          active={kind === "MEDIA"}
          onPress={() => setKind("MEDIA")}
        />
        <KindTab
          label="File"
          active={kind === "FILE"}
          onPress={() => setKind("FILE")}
        />
      </View>

      {query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : query.isLoading ? null : items.length === 0 ? (
        <EmptyState
          title={
            kind === "MEDIA" ? "Chưa có ảnh hoặc video" : "Chưa có file nào"
          }
          icon={kind === "MEDIA" ? "images-outline" : "document-outline"}
        />
      ) : kind === "MEDIA" ? (
        // Ô vuông cố định, ảnh cắt giữa — khác bong bóng chat (giữ tỉ lệ thật),
        // để lưới đều nhau. key theo kind vì FlatList không cho đổi numColumns
        // trên cùng 1 instance.
        <FlatList
          key="media-grid"
          data={items}
          keyExtractor={(m) => m.id}
          numColumns={COLUMNS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP }}
          onEndReached={loadMore}
          renderItem={({ item }) => (
            <Pressable
              accessibilityLabel={item.type === "VIDEO" ? "Mở video" : "Mở ảnh"}
              onPress={() =>
                router.push({
                  pathname: "/media-viewer",
                  params: { url: item.mediaUrl!, type: item.type },
                })
              }
              style={{ width: tileSize, height: tileSize }}
              className="bg-zinc-200 dark:bg-zinc-800"
            >
              <Image
                source={{
                  uri:
                    item.type === "VIDEO"
                      ? videoPosterUrl(item.mediaUrl!)
                      : item.mediaUrl!,
                }}
                style={{ flex: 1 }}
                contentFit="cover"
              />
              {item.type === "VIDEO" && (
                <View className="absolute inset-0 items-center justify-center bg-black/20">
                  <Ionicons name="play-circle" size={28} color="#fff" />
                </View>
              )}
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          key="file-list"
          data={items}
          keyExtractor={(m) => m.id}
          onEndReached={loadMore}
          renderItem={({ item }) => (
            <ListRow
              leading={
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color="#71717a"
                />
              }
              title={item.mediaName ?? "File"}
              subtitle={`${formatBytes(item.mediaSize ?? 0)} · ${formatRelativeTime(item.createdAt)}`}
              onPress={() => openFile(item.mediaUrl!)}
            />
          )}
        />
      )}
    </View>
  );
}
