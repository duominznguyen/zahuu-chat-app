import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConversationSearchResults } from "@/components/conversation-search-results";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { ListRow } from "@/components/list-row";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRelativeTime } from "@/lib/format-time";
import {
  listConversations,
  type ConversationSummary,
  type ConversationsPage,
} from "@/lib/conversations";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";

type ConversationsCache = InfiniteData<ConversationsPage, string | undefined>;

function patchOnlineStatus(
  data: ConversationsCache | undefined,
  userId: string,
  isOnline: boolean,
): ConversationsCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((c) =>
        c.otherUser?.id === userId ? { ...c, otherUser: { ...c.otherUser, isOnline } } : c,
      ),
    })),
  };
}
  
const MEDIA_LABEL: Record<string, string> = {
  IMAGE: "ảnh",
  VIDEO: "video",
  FILE: "file",
  STICKER: "sticker",
};

function previewText(c: ConversationSummary, myId: string | undefined) {
  if (!c.lastMessage) return "Hãy bắt đầu trò chuyện";
  if (c.lastMessage.isRecalled) return "Tin nhắn đã thu hồi";
  // Tin SYSTEM/CALL đã là 1 câu hoàn chỉnh dịch sẵn từ BE (vd "A đã thêm B vào
  // nhóm", "Cuộc gọi nhỡ") — không thêm tiền tố "Bạn: " như tin nhắn thường, và
  // không đi qua MEDIA_LABEL (không có nhãn cho CALL).
  if (c.lastMessage.previewText != null) return c.lastMessage.previewText;
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
    // Vá trực tiếp thay vì invalidate+refetch — presence đổi liên tục hơn
    // nhiều so với các event khác ở trên, refetch cả list mỗi lần online/
    // offline sẽ quá phí trong khi chỉ đổi đúng 1 field nhỏ của 1 item.
    const onPresence = ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      queryClient.setQueryData<ConversationsCache>(["conversations", "list"], (old) =>
        patchOnlineStatus(old, userId, isOnline),
      );
    };
    socket.on("presence:update", onPresence);
    return () => {
      socket.off("message:new", refetch);
      socket.off("message:recalled", refetch);
      socket.off("group:memberAdded", refetch);
      socket.off("group:memberRemoved", refetch);
      socket.off("group:updated", refetch);
      socket.off("presence:update", onPresence);
    };
  }, [socket, queryClient]);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  // Chế độ tìm kiếm chỉ thoát qua nút Đóng/Escape/chọn kết quả, không thoát
  // khi blur — blur xảy ra trước click nên sẽ gỡ kết quả trước khi kịp bấm.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchText("");
    searchInputRef.current?.blur();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Tin nhắn</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Tạo nhóm"
            onClick={() => navigate("/create-group", { state: { background: location } })}
          >
            <Plus />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Tìm bạn bè, nhóm hoặc @username"
              aria-label="Tìm kiếm đoạn chat"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeSearch();
              }}
              className="pl-8"
            />
          </div>
          {searchOpen && (
            <Button variant="ghost" size="sm" onClick={closeSearch}>
              Đóng
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {searchOpen ? (
          <ConversationSearchResults searchText={searchText} onPicked={closeSearch} />
        ) : query.isLoading ? null : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="Chưa có cuộc trò chuyện nào" />
        ) : (
          <>
            {items.map((item) => (
              <ListRow
                key={item.id}
                leading={
                  <UserAvatar name={item.name ?? "?"} src={item.avatarUrl} online={item.otherUser?.isOnline} />
                }
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
