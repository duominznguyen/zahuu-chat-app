import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { ListRow } from "@/components/list-row";
import { UserAvatar } from "@/components/user-avatar";
import { formatRelativeTime } from "@/lib/format-time";
import { listConversations, type ConversationSummary } from "@/lib/conversations";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";

const MEDIA_LABEL: Record<string, string> = {
  IMAGE: "ảnh",
  VIDEO: "video",
  FILE: "file",
  STICKER: "sticker",
};

function previewText(c: ConversationSummary, myId: string | undefined) {
  if (!c.lastMessage) return "Hãy bắt đầu trò chuyện";
  if (c.lastMessage.isRecalled) return "Tin nhắn đã thu hồi";
  const prefix = c.lastMessage.senderId === myId ? "Bạn: " : "";
  if (c.lastMessage.type !== "TEXT") {
    return `${prefix}Đã gửi 1 ${MEDIA_LABEL[c.lastMessage.type]}`;
  }
  return `${prefix}${c.lastMessage.content ?? ""}`;
}

export function ConversationListPane() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const myId = useAuthStore((s) => s.user?.id);

  const query = useInfiniteQuery({
    queryKey: ["conversations", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listConversations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  useEffect(() => {
    if (!socket) return;
    // Đơn giản hoá: có tin mới/thu hồi/thay đổi nhóm thì refetch lại cả list
    // thay vì tự vá từng item — list này không đổi liên tục nên chấp nhận phí
    // 1 request thừa mỗi lần (đúng pattern mobile).
    const refetch = () => queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
    socket.on("message:new", refetch);
    socket.on("message:recalled", refetch);
    socket.on("group:memberAdded", refetch);
    socket.on("group:memberRemoved", refetch);
    socket.on("group:updated", refetch);
    return () => {
      socket.off("message:new", refetch);
      socket.off("message:recalled", refetch);
      socket.off("group:memberAdded", refetch);
      socket.off("group:memberRemoved", refetch);
      socket.off("group:updated", refetch);
    };
  }, [socket, queryClient]);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold text-foreground">Tin nhắn</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {query.isLoading ? null : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="Chưa có cuộc trò chuyện nào" />
        ) : (
          <>
            {items.map((item) => (
              <ListRow
                key={item.id}
                leading={<UserAvatar name={item.name ?? "?"} src={item.avatarUrl} />}
                title={item.name ?? "Người dùng đã xóa"}
                subtitle={previewText(item, myId)}
                emphasized={item.unread}
                active={location.pathname === `/chat/${item.id}`}
                onClick={() => navigate(`/chat/${item.id}`)}
                trailing={
                  <div className="flex flex-col items-end gap-1.5">
                    {item.lastMessageAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(item.lastMessageAt)}
                      </span>
                    )}
                    {item.unread && <span className="size-2 rounded-full bg-primary" />}
                  </div>
                }
              />
            ))}
            <InfiniteScrollSentinel
              enabled={!!query.hasNextPage && !query.isFetchingNextPage}
              onVisible={() => query.fetchNextPage()}
            />
          </>
        )}
      </div>
    </div>
  );
}
