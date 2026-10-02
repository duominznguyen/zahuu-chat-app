import { Ionicons } from "@expo/vector-icons";
import { Image, type ImageLoadEventData } from "expo-image";
import { useState } from "react";
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
  // Ẩn khi tin này không phải tin CUỐI trong 1 chuỗi liên tiếp cùng người gửi
  // (kiểu Messenger) — vẫn chừa đúng khoảng trống của avatar để không lệch hàng.
  showAvatar?: boolean;
  onLongPress?: () => void;
  onPress?: () => void;
}

const AVATAR_SIZE = 28;

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

const MEDIA_MAX_WIDTH = 220;
const MEDIA_MAX_HEIGHT = 280;

// Server chưa lưu width/height ảnh gốc (chỉ mediaName/mediaSize cho FILE), nên
// phải đợi ảnh tải xong (onLoad) mới biết tỉ lệ thật — cache theo url để tin
// nhắn cũ cuộn lại vào view không bị nháy về khung mặc định lần nữa.
const mediaAspectRatioCache = new Map<string, number>();

// Chỉ giới hạn kích thước tối đa, giữ nguyên tỉ lệ thật — chấp nhận ảnh quá
// dài/quá ngang bị bẹp (không ép về khung tối thiểu như Messenger).
function clampMediaSize(ratio: number) {
  let width = MEDIA_MAX_WIDTH;
  let height = width / ratio;
  if (height > MEDIA_MAX_HEIGHT) {
    height = MEDIA_MAX_HEIGHT;
    width = height * ratio;
  }
  return { width, height };
}

function MediaPreview({ url, isVideo }: { url: string; isVideo: boolean }) {
  const [ratio, setRatio] = useState<number | null>(
    () => mediaAspectRatioCache.get(url) ?? null,
  );

  const handleLoad = (event: ImageLoadEventData) => {
    const { width, height } = event.source;
    if (!width || !height) return;
    const next = width / height;
    mediaAspectRatioCache.set(url, next);
    setRatio(next);
  };

  const { width, height } = ratio
    ? clampMediaSize(ratio)
    : { width: MEDIA_MAX_WIDTH, height: MEDIA_MAX_WIDTH };

  return (
    <View
      style={{ width, height }}
      className="relative overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-700"
    >
      <Image
        source={{ uri: url }}
        style={{ flex: 1 }}
        contentFit="cover"
        onLoad={handleLoad}
      />
      {isVideo && (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <Ionicons name="play-circle" size={40} color="#fff" />
        </View>
      )}
    </View>
  );
}

export function MessageBubble({
  message,
  isOwn,
  senderName,
  senderAvatarUrl,
  showAvatar = true,
  onLongPress,
  onPress,
}: MessageBubbleProps) {
  if (message.isRecalled) {
    return (
      <View
        className={`mb-2 flex-row items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}
      >
        {!isOwn &&
          (showAvatar ? (
            <Avatar
              uri={senderAvatarUrl}
              name={senderName}
              size={AVATAR_SIZE}
            />
          ) : (
            <View style={{ width: AVATAR_SIZE }} />
          ))}
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
      {!isOwn &&
        (showAvatar ? (
          <Avatar uri={senderAvatarUrl} name={senderName} size={AVATAR_SIZE} />
        ) : (
          <View style={{ width: AVATAR_SIZE }} />
        ))}
      <Pressable
        className="max-w-[75%]"
        onLongPress={onLongPress}
        onPress={onPress}
      >
        {message.type === "IMAGE" || message.type === "VIDEO" ? (
          message.mediaUrl && (
            <>
              {message.replyTo && (
                <View className="mb-1.5 rounded-lg border-l-2 border-zinc-400 bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                  <Text
                    numberOfLines={1}
                    className="text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    {message.replyTo.isRecalled
                      ? "Tin nhắn đã thu hồi"
                      : message.replyTo.content}
                  </Text>
                </View>
              )}
              <MediaPreview
                url={message.mediaUrl}
                isVideo={message.type === "VIDEO"}
              />
            </>
          )
        ) : (
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
              <Text className={`text-base ${textColor}`}>
                {message.content}
              </Text>
            )}

            {message.type === "STICKER" && (
              <Text className="text-5xl">{message.content}</Text>
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
        )}

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
