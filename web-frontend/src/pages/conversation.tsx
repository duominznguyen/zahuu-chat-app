import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChatInput } from "@/components/chat-input";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { MessageBubble } from "@/components/message-bubble";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { confirm } from "@/lib/confirm";
import { getConversationDetail, type ConversationDetail } from "@/lib/conversations";
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

// Thu hồi 1 tin phải cập nhật CẢ bản thân tin đó LẪN bất kỳ tin nào khác đang
// "trả lời" nó — replyTo là snapshot nhúng vào từng tin lúc fetch, không tự
// đồng bộ khi tin gốc đổi trạng thái sau đó.
function applyRecall(data: MessagesCache | undefined, messageId: string): MessagesCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((m) => {
        if (m.id === messageId) {
          return { ...m, isRecalled: true, content: null, reactions: [] };
        }
        if (m.replyTo?.id === messageId) {
          return { ...m, replyTo: { ...m.replyTo, content: null, isRecalled: true } };
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

function prependMessage(data: MessagesCache | undefined, message: Message): MessagesCache | undefined {
  if (!data || data.pages.length === 0) {
    return { pages: [{ items: [message], nextCursor: null }], pageParams: [undefined] };
  }
  // Chặn trùng id — tin tới 2 lần (vd StrictMode / nhiều listener) không chèn
  // trùng, tránh key trùng trong list.
  if (data.pages.some((p) => p.items.some((m) => m.id === message.id))) return data;
  const pages = [...data.pages];
  pages[0] = { ...pages[0], items: [message, ...pages[0].items] };
  return { ...data, pages };
}

export default function Conversation() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const id = conversationId!;
  const navigate = useNavigate();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);

  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const lastMarkedReadId = useRef<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", id],
    queryFn: () => getConversationDetail(id),
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: ["messages", id],
    queryFn: ({ pageParam }: { pageParam?: string }) => listMessages(id, pageParam),
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
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) => prependMessage(old, message));
      if (message.sender.id !== myId) markReadIfNeeded(message.id);
    };
    const onRecalled = ({ messageId }: { messageId: string; conversationId: string }) => {
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) => applyRecall(old, messageId));
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
            ? [...m.reactions.filter((r) => r.userId !== userId), { userId, reactionType }]
            : m.reactions.filter((r) => r.userId !== userId),
        })),
      );
    };
    const onRead = ({ userId, lastReadMessageId }: { userId: string; lastReadMessageId: string }) => {
      queryClient.setQueryData<ConversationDetail>(["conversations", "detail", id], (old) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.map((m) => (m.id === userId ? { ...m, lastReadMessageId } : m)),
        };
      });
    };
    const onGroupUpdated = ({ conversationId: cid }: { conversationId: string }) => {
      if (cid !== id) return;
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail", id] });
    };
    const onMemberRemoved = ({
      conversationId: cid,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      if (cid !== id) return;
      // Message trung lập vì event này bắn cho cả người tự rời (không riêng bị
      // admin xóa) — không phân biệt được 2 trường hợp từ payload.
      if (userId === myId) {
        toast.info("Bạn không còn trong nhóm này");
        navigate("/chat");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail", id] });
    };

    socket.on("message:new", onNew);
    socket.on("message:recalled", onRecalled);
    socket.on("message:reaction", onReaction);
    socket.on("message:read", onRead);
    socket.on("group:updated", onGroupUpdated);
    socket.on("group:memberAdded", onGroupUpdated);
    socket.on("group:memberRemoved", onMemberRemoved);
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:recalled", onRecalled);
      socket.off("message:reaction", onReaction);
      socket.off("message:read", onRead);
      socket.off("group:updated", onGroupUpdated);
      socket.off("group:memberAdded", onGroupUpdated);
      socket.off("group:memberRemoved", onMemberRemoved);
    };
    // Không emit conversation:leave lúc unmount — socket dùng chung toàn app,
    // rời room sẽ làm List Pane mất luôn update real-time của chính room này.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id, queryClient, myId]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendTextMessage(id, content, replyTarget?.id),
    onSuccess: () => setReplyTarget(null),
    // Không tự chèn vào cache — message:new sẽ tự đến qua socket (server
    // broadcast cho mọi member trong room, kể cả chính người gửi).
    onError: () => toast.error("Gửi tin nhắn thất bại, vui lòng thử lại"),
  });

  const recallMutation = useMutation({ mutationFn: (messageId: string) => recallMessage(messageId) });

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
    mutationFn: ({ messageId, reactionType }: { messageId: string; reactionType: ReactionType }) =>
      setReaction(messageId, reactionType),
  });
  const removeReactionMutation = useMutation({
    mutationFn: (messageId: string) => removeReaction(messageId),
  });

  const isDirect = detailQuery.data?.type === "DIRECT";
  const otherMember = isDirect ? detailQuery.data?.members.find((m) => m.id !== myId) : undefined;
  const title = detailQuery.data?.name ?? "...";

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => toast("Thông tin hội thoại sẽ có ở milestone sau")}
        >
          <UserAvatar name={title} src={detailQuery.data?.avatarUrl} />
          <span className="truncate font-medium text-foreground">{title}</span>
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {detailQuery.data?.backgroundUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${detailQuery.data.backgroundUrl})` }}
          />
        )}

        {messagesQuery.isError ? (
          <ErrorState onRetry={() => messagesQuery.refetch()} />
        ) : !messagesQuery.isLoading && messages.length === 0 ? (
          <EmptyState icon={<MessageCircle className="size-10" />} title="Hãy bắt đầu trò chuyện" />
        ) : (
          <div className="relative flex h-full flex-col-reverse overflow-y-auto px-3 py-2">
            {messages.map((item, index) => {
              const isOwn = item.sender.id === myId;
              const seen = isOwn && otherMember?.lastReadMessageId === item.id;
              // messages mới nhất trước (index 0) — nhờ flex-col-reverse nên
              // index 0 hiện ở DƯỚI CÙNG (giống inverted list bên mobile): tin
              // ở index-1 mới hơn (hiện dưới tin này), index+1 cũ hơn (hiện
              // trên tin này). Avatar hiện ở tin CUỐI 1 chuỗi (dưới cùng), tên
              // người gửi (chỉ GROUP) hiện ở tin ĐẦU chuỗi (trên cùng).
              const nextMessage = messages[index - 1];
              const prevMessage = messages[index + 1];
              const showAvatar = !nextMessage || nextMessage.sender.id !== item.sender.id;
              const showSenderName =
                !isDirect && (!prevMessage || prevMessage.sender.id !== item.sender.id);
              const myReaction = item.reactions.find((r) => r.userId === myId)?.reactionType;

              return (
                <MessageBubble
                  key={item.id}
                  message={item}
                  isOwn={isOwn}
                  showAvatar={showAvatar}
                  showSenderName={showSenderName}
                  seen={!!seen}
                  myReaction={myReaction}
                  onReply={() => setReplyTarget(item)}
                  onReact={(type) => reactMutation.mutate({ messageId: item.id, reactionType: type })}
                  onRemoveReaction={() => removeReactionMutation.mutate(item.id)}
                  onRecall={async () => {
                    const ok = await confirm({
                      title: "Thu hồi tin nhắn?",
                      destructive: true,
                      confirmLabel: "Thu hồi",
                    });
                    if (ok) recallMutation.mutate(item.id);
                  }}
                  onDelete={() => deleteMutation.mutate(item.id)}
                />
              );
            })}
            <InfiniteScrollSentinel
              enabled={!!messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage}
              onVisible={() => messagesQuery.fetchNextPage()}
            />
          </div>
        )}
      </div>

      {replyTarget && (
        <div className="flex items-center justify-between border-t border-border bg-secondary px-4 py-2">
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            Trả lời: {replyTarget.isRecalled ? "Tin nhắn đã thu hồi" : replyTarget.content}
          </p>
          <Button variant="ghost" size="icon-sm" aria-label="Hủy trả lời" onClick={() => setReplyTarget(null)}>
            <X />
          </Button>
        </div>
      )}

      <ChatInput onSend={(text) => sendMutation.mutate(text)} />
    </div>
  );
}
