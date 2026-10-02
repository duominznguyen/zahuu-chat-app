import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import type { InfiniteData } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import {
  ActionSheet,
  Avatar,
  ChatInput,
  EmptyState,
  ErrorState,
  Header,
  MessageBubble,
  confirm,
  useToast,
} from "@/components/ui";
import type { ActionSheetItem } from "@/components/ui/action-sheet";
import {
  getConversationDetail,
  type ConversationDetail,
} from "@/lib/conversations";
import {
  deleteMessageForMe,
  listMessages,
  markRead,
  recallMessage,
  removeReaction,
  sendTextMessage,
  setReaction,
  type Message,
  type MessagesPage,
  type ReactionType,
} from "@/lib/messages";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";

const REACTIONS: ReactionType[] = [
  "like",
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
];
const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😠",
};

type MessagesCache = InfiniteData<MessagesPage, string | undefined>;

function patchMessage(
  data: MessagesCache | undefined,
  messageId: string,
  updater: (m: Message) => Message,
): MessagesCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((m) => (m.id === messageId ? updater(m) : m)),
    })),
  };
}

// Thu hồi 1 tin phải cập nhật CẢ BẢN THÂN tin đó LẪN bất kỳ tin nào khác đang
// "trả lời" nó — replyTo là 1 bản snapshot riêng được nhúng vào từng tin lúc
// fetch, không tự động đồng bộ khi tin gốc đổi trạng thái sau đó.
function applyRecall(
  data: MessagesCache | undefined,
  messageId: string,
): MessagesCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            isRecalled: true,
            content: null,
            mediaUrl: null,
            mediaPublicId: null,
            mediaName: null,
            mediaSize: null,
            reactions: [],
          };
        }
        if (m.replyTo?.id === messageId) {
          return {
            ...m,
            replyTo: { ...m.replyTo, content: null, isRecalled: true },
          };
        }
        return m;
      }),
    })),
  };
}

function removeMessageFromCache(
  data: MessagesCache | undefined,
  messageId: string,
): MessagesCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((m) => m.id !== messageId),
    })),
  };
}

function prependMessage(
  data: MessagesCache | undefined,
  message: Message,
): MessagesCache | undefined {
  if (!data || data.pages.length === 0) {
    return {
      pages: [{ items: [message], nextCursor: null }],
      pageParams: [undefined],
    };
  }
  const pages = [...data.pages];
  pages[0] = { ...pages[0], items: [message, ...pages[0].items] };
  return { ...data, pages };
}

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const toast = useToast();
  const myId = useAuthStore((s) => s.user?.id);

  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [menuTarget, setMenuTarget] = useState<Message | null>(null);
  const lastMarkedReadId = useRef<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", id],
    queryFn: () => getConversationDetail(id),
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: ["messages", id],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      listMessages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const messages = messagesQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const markReadIfNeeded = (messageId: string) => {
    if (lastMarkedReadId.current === messageId) return;
    lastMarkedReadId.current = messageId;
    markRead(id, messageId).catch(() => {
      lastMarkedReadId.current = null;
    });
  };

  useEffect(() => {
    if (messages.length > 0) markReadIfNeeded(messages[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages[0]?.id]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("conversation:join", { conversationId: id });

    const onNew = (message: Message) => {
      if (message.conversationId !== id) return;
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) =>
        prependMessage(old, message),
      );
      if (message.sender.id !== myId) markReadIfNeeded(message.id);
    };
    const onRecalled = ({
      messageId,
    }: {
      messageId: string;
      conversationId: string;
    }) => {
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) =>
        applyRecall(old, messageId),
      );
    };
    const onReaction = ({
      messageId,
      userId,
      reactionType,
    }: {
      messageId: string;
      userId: string;
      reactionType: ReactionType | null;
    }) => {
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) =>
        patchMessage(old, messageId, (m) => ({
          ...m,
          reactions: reactionType
            ? [
                ...m.reactions.filter((r) => r.userId !== userId),
                { userId, reactionType },
              ]
            : m.reactions.filter((r) => r.userId !== userId),
        })),
      );
    };
    const onRead = ({
      userId,
      lastReadMessageId,
    }: {
      userId: string;
      lastReadMessageId: string;
    }) => {
      queryClient.setQueryData<ConversationDetail>(
        ["conversations", "detail", id],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            members: old.members.map((m) =>
              m.id === userId ? { ...m, lastReadMessageId } : m,
            ),
          };
        },
      );
    };

    socket.on("message:new", onNew);
    socket.on("message:recalled", onRecalled);
    socket.on("message:reaction", onReaction);
    socket.on("message:read", onRead);
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:recalled", onRecalled);
      socket.off("message:reaction", onReaction);
      socket.off("message:read", onRead);
    };
    // Không emit conversation:leave khi unmount — socket dùng chung toàn app,
    // rời room sẽ làm tab Tin nhắn mất luôn update real-time của chính room này.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id, queryClient, myId]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      sendTextMessage(id, content, replyTarget?.id),
    onSuccess: () => setReplyTarget(null),
    // Không tự chèn vào cache ở đây — message:new sẽ tự đến qua socket (server
    // broadcast cho mọi member trong room, kể cả chính người gửi).
  });

  const recallMutation = useMutation({
    mutationFn: (messageId: string) => recallMessage(messageId),
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => deleteMessageForMe(messageId),
    onSuccess: (_res, messageId) => {
      // "Xóa cho mình" KHÔNG bắn socket event -> phải tự xóa khỏi cache local.
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) =>
        removeMessageFromCache(old, messageId),
      );
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({
      messageId,
      reactionType,
    }: {
      messageId: string;
      reactionType: ReactionType;
    }) => setReaction(messageId, reactionType),
  });
  const removeReactionMutation = useMutation({
    mutationFn: (messageId: string) => removeReaction(messageId),
  });

  const otherMember = detailQuery.data?.members.find((m) => m.id !== myId);
  const title =
    detailQuery.data?.type === "GROUP"
      ? (detailQuery.data?.name ?? "Nhóm")
      : (otherMember?.nickname ??
        otherMember?.displayName ??
        detailQuery.data?.name ??
        "...");

  const myReaction = menuTarget?.reactions.find(
    (r) => r.userId === myId,
  )?.reactionType;

  const menuItems: ActionSheetItem[] = menuTarget
    ? [
        ...(!menuTarget.isRecalled
          ? [
              {
                key: "reply",
                label: "Trả lời",
                icon: "arrow-undo-outline" as const,
                onPress: () => setReplyTarget(menuTarget),
              },
              ...(menuTarget.type === "TEXT"
                ? [
                    {
                      key: "copy",
                      label: "Sao chép",
                      icon: "copy-outline" as const,
                      onPress: async () => {
                        await Clipboard.setStringAsync(
                          menuTarget.content ?? "",
                        );
                        toast.show("Đã sao chép");
                      },
                    },
                  ]
                : []),
            ]
          : []),
        ...(menuTarget.sender.id === myId && !menuTarget.isRecalled
          ? [
              {
                key: "recall",
                label: "Thu hồi",
                icon: "arrow-undo-circle-outline" as const,
                destructive: true,
                onPress: async () => {
                  const ok = await confirm({
                    title: "Thu hồi tin nhắn?",
                    destructive: true,
                    confirmLabel: "Thu hồi",
                  });
                  if (ok) recallMutation.mutate(menuTarget.id);
                },
              },
            ]
          : []),
        {
          key: "delete",
          label: "Xóa (chỉ ở máy tôi)",
          icon: "trash-outline" as const,
          destructive: true,
          onPress: () => deleteMutation.mutate(menuTarget.id),
        },
      ]
    : [];

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Header
        title={title}
        right={
          otherMember ? (
            <Avatar
              name={otherMember.displayName}
              uri={otherMember.avatarUrl}
              size={32}
            />
          ) : undefined
        }
      />

      {messagesQuery.isError ? (
        <ErrorState onRetry={() => messagesQuery.refetch()} />
      ) : !messagesQuery.isLoading && messages.length === 0 ? (
        <EmptyState title="Hãy bắt đầu trò chuyện" icon="chatbubble-outline" />
      ) : (
        <FlatList
          className="flex-1"
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          onEndReached={() => {
            if (messagesQuery.hasNextPage) messagesQuery.fetchNextPage();
          }}
          contentContainerClassName="px-3 py-2"
          renderItem={({ item, index }) => {
            const isOwn = item.sender.id === myId;
            const seen = isOwn && otherMember?.lastReadMessageId === item.id;
            // messages mới nhất trước (index 0 = mới nhất = hiện dưới cùng do
            // inverted) -> tin ở index-1 là tin GẦN ĐÂY HƠN (hiện dưới tin này).
            // Avatar chỉ hiện ở tin cuối cùng của 1 chuỗi liên tiếp cùng người gửi.
            const nextMessage = messages[index - 1];
            const showAvatar =
              !nextMessage || nextMessage.sender.id !== item.sender.id;
            return (
              <View>
                <MessageBubble
                  isOwn={isOwn}
                  senderName={item.sender.displayName}
                  senderAvatarUrl={item.sender.avatarUrl}
                  showAvatar={showAvatar}
                  onLongPress={() => setMenuTarget(item)}
                  message={{
                    id: item.id,
                    type: item.type,
                    content: item.content,
                    mediaUrl: item.mediaUrl,
                    mediaName: item.mediaName,
                    mediaSize: item.mediaSize,
                    isRecalled: item.isRecalled,
                    replyTo: item.replyTo
                      ? {
                          content: item.replyTo.content,
                          isRecalled: item.replyTo.isRecalled,
                        }
                      : null,
                    reactionEmojis: Array.from(
                      new Set(item.reactions.map((r) => r.reactionType)),
                    ),
                  }}
                />
                {seen && (
                  <Text className="-mt-1 mb-2 text-right text-xs text-zinc-400">
                    Đã xem
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}

      {replyTarget && (
        <View className="flex-row items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <Text
            numberOfLines={1}
            className="flex-1 text-sm text-zinc-500 dark:text-zinc-400"
          >
            Trả lời:{" "}
            {replyTarget.isRecalled
              ? "Tin nhắn đã thu hồi"
              : replyTarget.content}
          </Text>
          <Pressable onPress={() => setReplyTarget(null)} className="px-2">
            <Text className="text-zinc-400">✕</Text>
          </Pressable>
        </View>
      )}

      <ChatInput
        onSend={(text) => sendMutation.mutate(text)}
        onAttach={() => toast.show("Gửi ảnh/file sẽ có ở milestone sau")}
      />

      <ActionSheet
        visible={!!menuTarget}
        onClose={() => setMenuTarget(null)}
        header={
          menuTarget && !menuTarget.isRecalled ? (
            <View className="flex-row justify-around border-b border-zinc-100 px-2 py-3 dark:border-zinc-800">
              {REACTIONS.map((r) => (
                <Pressable
                  key={r}
                  className="p-1"
                  onPress={() => {
                    if (!menuTarget) return;
                    setMenuTarget(null);
                    if (myReaction === r)
                      removeReactionMutation.mutate(menuTarget.id);
                    else
                      reactMutation.mutate({
                        messageId: menuTarget.id,
                        reactionType: r,
                      });
                  }}
                >
                  <Text className="text-2xl">{REACTION_EMOJI[r]}</Text>
                </Pressable>
              ))}
            </View>
          ) : undefined
        }
        items={menuItems}
      />
    </KeyboardAvoidingView>
  );
}
