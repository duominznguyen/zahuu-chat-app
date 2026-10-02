import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "./avatar";

export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "STICKER";

export interface MessageBubbleData {
  id: string;
  type: MessageType;
  content: string | null;
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaSize?: number | null;
  isRecalled: boolean;
  replyTo: { content: string | null; isRecalled: boolean } | null;
  reactionEmojis?: string[]; // vd ['like', 'love'] — đã gộp sẵn, không trùng
}

interface MessageBubbleProps {
  message: MessageBubbleData;
  isOwn: boolean;
  senderName: string;
  senderAvatarUrl?: string | null;
  onLongPress?: () => void;
}

const REACTION_ICON: Record<string, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😠",
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageBubble({
  message,
  isOwn,
  senderName,
  senderAvatarUrl,
  onLongPress,
}: MessageBubbleProps) {
  if (message.isRecalled) {
    return (
      <View
        className={`mb-2 flex-row ${isOwn ? "justify-end" : "justify-start"}`}
      >
        <View className="max-w-[75%] rounded-2xl bg-zinc-100 px-4 py-2.5 dark:bg-zinc-800">
          <Text className="text-sm italic text-zinc-500 dark:text-zinc-400">
            Tin nhắn đã thu hồi
          </Text>
        </View>
      </View>
    );
  }

  const bubbleColor = isOwn
    ? "bg-primary dark:bg-primary-dark"
    : "bg-zinc-100 dark:bg-zinc-800";
  const textColor = isOwn
    ? "text-white dark:text-zinc-900"
    : "text-zinc-900 dark:text-zinc-100";

  return (
    <View
      className={`mb-2 flex-row items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}
    >
      {!isOwn && <Avatar uri={senderAvatarUrl} name={senderName} size={28} />}
      <Pressable className="max-w-[75%]" onLongPress={onLongPress}>
        <View className={`rounded-2xl px-4 py-2.5 ${bubbleColor}`}>
          {message.replyTo && (
            <View
              className={`mb-1.5 border-l-2 pl-2 ${isOwn ? "border-white/50" : "border-zinc-400"}`}
            >
              <Text
                numberOfLines={1}
                className={`text-xs ${isOwn ? "text-white/80" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                {message.replyTo.isRecalled
                  ? "Tin nhắn đã thu hồi"
                  : message.replyTo.content}
              </Text>
            </View>
          )}

          {message.type === "TEXT" && (
            <Text className={`text-base ${textColor}`}>{message.content}</Text>
          )}

          {message.type === "STICKER" && (
            <Text className="text-5xl">{message.content}</Text>
          )}

          {(message.type === "IMAGE" || message.type === "VIDEO") &&
            message.mediaUrl && (
              <View className="relative h-48 w-48 overflow-hidden rounded-lg">
                <Image
                  source={{ uri: message.mediaUrl }}
                  style={{ flex: 1 }}
                  contentFit="cover"
                />
                {message.type === "VIDEO" && (
                  <View className="absolute inset-0 items-center justify-center bg-black/20">
                    <Ionicons name="play-circle" size={40} color="#fff" />
                  </View>
                )}
              </View>
            )}

          {message.type === "FILE" && (
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="document-text-outline"
                size={28}
                color={isOwn ? "#fff" : "#71717a"}
              />
              <View className="shrink">
                <Text
                  numberOfLines={1}
                  className={`text-sm font-medium ${textColor}`}
                >
                  {message.mediaName ?? "File"}
                </Text>
                {message.mediaSize != null && (
                  <Text
                    className={`text-xs ${isOwn ? "text-white/70" : "text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {formatBytes(message.mediaSize)}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {!!message.reactionEmojis?.length && (
          <View className="-mt-2 ml-auto mr-1 flex-row rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900">
            {message.reactionEmojis.map((r) => (
              <Text key={r} className="text-xs">
                {REACTION_ICON[r] ?? ""}
              </Text>
            ))}
          </View>
        )}
      </Pressable>
    </View>
  );
}
