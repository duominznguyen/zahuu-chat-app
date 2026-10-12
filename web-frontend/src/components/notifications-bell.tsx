import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { railItemClass } from "@/components/app-shell/rail-item-class";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { ListRow } from "@/components/list-row";
import { UserAvatar } from "@/components/user-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRelativeTime } from "@/lib/format-time";
import {
  listNotifications,
  markNotificationRead,
  type AppNotification,
  type NotificationsPage,
} from "@/lib/notifications";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";

type NotificationsCache = InfiniteData<NotificationsPage, string | undefined>;

function notificationText(n: AppNotification) {
  const name = n.actor?.displayName ?? "Ai đó";
  switch (n.type) {
    case "FRIEND_REQUEST_RECEIVED":
      return `${name} đã gửi lời mời kết bạn`;
    case "FRIEND_REQUEST_ACCEPTED":
      return `${name} đã chấp nhận lời mời kết bạn`;
    case "GROUP_MEMBER_ADDED":
      return `${name} đã thêm bạn vào nhóm`;
  }
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const socket = useSocket();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();
  const location = useLocation();

  // Không có endpoint đếm riêng -> khởi tạo bằng cách đếm isRead:false trong
  // trang đầu GET /notifications, rồi tự cộng/trừ qua socket trong lúc app mở
  // (cộng ở đây, trừ trong markReadMutation bên dưới).
  const unreadCountQuery = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: async () => {
      const page = await listNotifications();
      return page.items.filter((n) => !n.isRead).length;
    },
  });

  useEffect(() => {
    if (!socket) return;
    const bump = () =>
      queryClient.setQueryData<number>(["notifications", "unreadCount"], (c) => (c ?? 0) + 1);
    // group:memberAdded còn bắn lúc tạo DIRECT/GROUP mới (chỉ để tự join room,
    // không phải thông báo thật) -> phải lọc đúng theo cờ notify server gửi kèm.
    const onGroupMemberAdded = ({ member, notify }: { member: { id: string }; notify: boolean }) => {
      if (notify && member.id === myId) bump();
    };
    socket.on("friend:requestReceived", bump);
    socket.on("friend:accepted", bump);
    socket.on("group:memberAdded", onGroupMemberAdded);
    return () => {
      socket.off("friend:requestReceived", bump);
      socket.off("friend:accepted", bump);
      socket.off("group:memberAdded", onGroupMemberAdded);
    };
  }, [socket, queryClient, myId]);

  const query = useInfiniteQuery({
    queryKey: ["notifications", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<NotificationsCache>(["notifications", "list"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
          })),
        };
      });
      queryClient.setQueryData<number>(["notifications", "unreadCount"], (c) => Math.max(0, (c ?? 0) - 1));
    },
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const handleClick = (n: AppNotification) => {
    if (!n.isRead) markReadMutation.mutate(n.id);
    setOpen(false);
    switch (n.type) {
      case "FRIEND_REQUEST_RECEIVED":
        navigate("/friends?tab=requests");
        return;
      case "FRIEND_REQUEST_ACCEPTED":
        if (n.actor) navigate(`/u/${n.actor.id}`, { state: { background: location } });
        return;
      case "GROUP_MEMBER_ADDED":
        if (n.conversationId) navigate(`/chat/${n.conversationId}`);
        return;
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Radix có thể giữ nội dung Popover mounted ngầm giữa các lần đóng/mở
        // (phụ thuộc version, không chắc chắn) — chủ động refetch mỗi lần mở
        // thay vì tin vào effect-on-mount, để không đọc phải dữ liệu cũ do
        // race giữa socket báo tới và transaction ghi Notification ghi xong
        // (2 việc chạy độc lập, không đồng bộ với nhau).
        if (next) query.refetch();
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" aria-label="Thông báo" className={`relative ${railItemClass(false)}`}>
          <Bell className="size-5" />
          {!!unreadCountQuery.data && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {unreadCountQuery.data > 99 ? "99+" : unreadCountQuery.data}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-0">
        <div className="max-h-96 overflow-y-auto">
          {query.isLoading ? null : query.isError ? (
            <ErrorState onRetry={() => query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState icon={<Bell className="size-10" />} title="Chưa có thông báo nào" />
          ) : (
            <>
              {items.map((n) => (
                <ListRow
                  key={n.id}
                  leading={<UserAvatar name={n.actor?.displayName ?? "?"} src={n.actor?.avatarUrl} />}
                  title={notificationText(n)}
                  subtitle={formatRelativeTime(n.createdAt)}
                  emphasized={!n.isRead}
                  trailing={!n.isRead ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : undefined}
                  onClick={() => handleClick(n)}
                />
              ))}
              <InfiniteScrollSentinel
                enabled={!!query.hasNextPage && !query.isFetchingNextPage}
                onVisible={() => query.fetchNextPage()}
              />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
