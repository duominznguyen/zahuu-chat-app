import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, MoreHorizontal, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { ListRow } from "@/components/list-row";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { confirm } from "@/lib/confirm";
import {
  blockUser,
  cancelFriendRequest,
  listFriendRequests,
  listFriends,
  respondFriendRequest,
  searchFriendsByName,
  searchUsersByUsername,
  sendFriendRequest,
  unfriend,
  type FriendItem,
  type FriendRequestItem,
  type PublicUser,
} from "@/lib/friends";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useSocket } from "@/providers/socket-provider";

function TabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      }`}
    >
      {children}
      {!!badge && (
        <Badge variant={active ? "secondary" : "default"} className="h-4.5 px-1.5">
          {badge}
        </Badge>
      )}
    </button>
  );
}

function FriendRow({
  item,
  active,
  onUnfriend,
  onBlock,
}: {
  item: FriendItem;
  active: boolean;
  onUnfriend: (userId: string) => void;
  onBlock: (userId: string) => void;
}) {
  const navigate = useNavigate();

  return (
    <ListRow
      leading={<UserAvatar name={item.user.displayName} src={item.user.avatarUrl} />}
      title={item.user.displayName}
      subtitle={`@${item.user.username}`}
      active={active}
      onClick={() => navigate(`/friends/${item.user.id}`)}
      trailing={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Thêm tùy chọn">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: "Hủy kết bạn?",
                  description: `Bạn sẽ không còn là bạn bè với ${item.user.displayName}.`,
                  destructive: true,
                  confirmLabel: "Hủy kết bạn",
                });
                if (ok) onUnfriend(item.user.id);
              }}
            >
              Hủy kết bạn
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: "Chặn người này?",
                  description: `${item.user.displayName} sẽ không thể liên hệ với bạn.`,
                  destructive: true,
                  confirmLabel: "Chặn",
                });
                if (ok) onBlock(item.user.id);
              }}
            >
              Chặn
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}

function SearchResultRow({ user }: { user: PublicUser }) {
  const navigate = useNavigate();
  const mutation = useMutation({ mutationFn: () => sendFriendRequest(user.id) });

  const errorCode =
    mutation.error instanceof ApiError
      ? ((mutation.error.body as { code?: string })?.code ?? null)
      : null;
  const alreadyFriends = errorCode === "ALREADY_FRIENDS";
  const alreadySent = errorCode === "REQUEST_ALREADY_SENT";

  let label = "Kết bạn";
  let disabled = false;
  if (mutation.isSuccess || alreadySent) {
    label = "Đã gửi lời mời";
    disabled = true;
  } else if (alreadyFriends) {
    label = "Đã là bạn bè";
    disabled = true;
  }

  return (
    <ListRow
      leading={<UserAvatar name={user.displayName} src={user.avatarUrl} />}
      title={user.displayName}
      subtitle={`@${user.username}`}
      onClick={() => navigate(`/friends/${user.id}`)}
      trailing={
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {label}
        </Button>
      }
    />
  );
}

// FriendsListPane ở trong ListPane nên KHÔNG unmount/remount giữa các path con
// /friends/:userId (chỉ cùng pathname-prefix) — "Xem lời mời kết bạn" điều
// hướng bằng query string (?tab=requests) nên bọc ngoài 1 wrapper, key theo
// chính query string đó để ép remount lại useState ban đầu, thay vì dùng
// effect đồng bộ ngược (set-state-in-effect dễ gây render thừa không cần thiết).
export function FriendsListPane() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "requests" ? "requests" : "friends";
  return <FriendsListPaneBody key={initialTab} initialTab={initialTab} />;
}

function FriendsListPaneBody({ initialTab }: { initialTab: "friends" | "requests" }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [tab, setTab] = useState<"friends" | "requests">(initialTab);
  const [requestsSubTab, setRequestsSubTab] = useState<"received" | "sent">("received");
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText.trim(), 300);
  const isUsernameMode = debouncedSearch.startsWith("@");
  const usernameQuery = isUsernameMode ? debouncedSearch.slice(1) : "";
  const nameQuery = isUsernameMode ? "" : debouncedSearch;
  const isSearching = debouncedSearch.length > 0;

  const friendsQuery = useInfiniteQuery({
    queryKey: ["friends", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listFriends(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const receivedRequestsQuery = useQuery({
    queryKey: ["friend-requests", "received"],
    queryFn: () => listFriendRequests("received"),
  });

  const sentRequestsQuery = useQuery({
    queryKey: ["friend-requests", "sent"],
    queryFn: () => listFriendRequests("sent"),
    enabled: tab === "requests" && requestsSubTab === "sent",
  });

  // ≥3 ký tự (khớp rate limit/giới hạn backend) cho username (public, khớp
  // tiền tố); tên hiển thị không giới hạn tối thiểu vì chỉ tìm trong bạn bè.
  const usernameSearchQuery = useQuery({
    queryKey: ["users", "search", usernameQuery],
    queryFn: () => searchUsersByUsername(usernameQuery),
    enabled: isUsernameMode && usernameQuery.length >= 3,
  });

  const nameSearchQuery = useQuery({
    queryKey: ["friends", "search", nameQuery],
    queryFn: () => searchFriendsByName(nameQuery),
    enabled: !isUsernameMode && nameQuery.length >= 1,
  });

  useEffect(() => {
    if (!socket) return;
    // Người kia chấp nhận/gửi lời mời không tự báo cho cache phía mình — nếu
    // không invalidate thủ công, danh sách chỉ đúng lại sau khi hết staleTime
    // mặc định (30s) hoặc rời rồi quay lại pane này.
    const onAccepted = () => queryClient.invalidateQueries({ queryKey: ["friends"] });
    const onRequestReceived = () =>
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    socket.on("friend:accepted", onAccepted);
    socket.on("friend:requestReceived", onRequestReceived);
    return () => {
      socket.off("friend:accepted", onAccepted);
      socket.off("friend:requestReceived", onRequestReceived);
    };
  }, [socket, queryClient]);

  const unfriendMutation = useMutation({
    mutationFn: (userId: string) => unfriend(userId),
    onSuccess: () => {
      toast.success("Đã hủy kết bạn");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const blockMutation = useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onSuccess: () => {
      toast.success("Đã chặn");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "reject" }) =>
      respondFriendRequest(id, action),
    onSuccess: (_res, { action }) => {
      toast.success(action === "accept" ? "Đã chấp nhận lời mời" : "Đã từ chối lời mời");
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelFriendRequest(id),
    onSuccess: () => {
      toast.success("Đã hủy lời mời");
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });

  const friends = friendsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const pendingCount = receivedRequestsQuery.data?.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h2 className="mb-3 text-lg font-semibold text-foreground">Bạn bè</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="@username hoặc tên bạn bè"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-8"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Gõ @ để tìm theo username (công khai), hoặc gõ tên để tìm trong bạn bè
        </p>
      </div>

      {isSearching ? (
        <div className="flex-1 overflow-y-auto">
          {isUsernameMode && usernameQuery.length < 3 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nhập ít nhất 3 ký tự sau @ để tìm
            </p>
          ) : isUsernameMode ? (
            usernameSearchQuery.isLoading ? null : !usernameSearchQuery.data?.length ? (
              <EmptyState icon={<Search className="size-10" />} title="Không tìm thấy ai" />
            ) : (
              usernameSearchQuery.data.map((user) => <SearchResultRow key={user.id} user={user} />)
            )
          ) : nameSearchQuery.isLoading ? null : !nameSearchQuery.data?.length ? (
            <EmptyState icon={<Search className="size-10" />} title="Không tìm thấy bạn bè nào" />
          ) : (
            nameSearchQuery.data.map((user) => <SearchResultRow key={user.id} user={user} />)
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2 p-3">
            <TabButton active={tab === "friends"} onClick={() => setTab("friends")}>
              Bạn bè
            </TabButton>
            <TabButton
              active={tab === "requests"}
              onClick={() => setTab("requests")}
              badge={pendingCount}
            >
              Lời mời
            </TabButton>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "friends" ? (
              friendsQuery.isLoading ? null : friendsQuery.isError ? (
                <ErrorState onRetry={() => friendsQuery.refetch()} />
              ) : friends.length === 0 ? (
                <EmptyState icon={<Users className="size-10" />} title="Chưa có bạn bè nào" />
              ) : (
                <>
                  {friends.map((item) => (
                    <FriendRow
                      key={item.friendshipId}
                      item={item}
                      active={location.pathname === `/friends/${item.user.id}`}
                      onUnfriend={(userId) => unfriendMutation.mutate(userId)}
                      onBlock={(userId) => blockMutation.mutate(userId)}
                    />
                  ))}
                  <InfiniteScrollSentinel
                    enabled={!!friendsQuery.hasNextPage && !friendsQuery.isFetchingNextPage}
                    onVisible={() => friendsQuery.fetchNextPage()}
                  />
                </>
              )
            ) : (
              <>
                <div className="flex gap-2 px-3 pb-2">
                  {(["received", "sent"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRequestsSubTab(t)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        requestsSubTab === t
                          ? "bg-foreground text-background"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {t === "received" ? "Đã nhận" : "Đã gửi"}
                    </button>
                  ))}
                </div>

                {requestsSubTab === "received" ? (
                  receivedRequestsQuery.isLoading ? null : receivedRequestsQuery.isError ? (
                    <ErrorState onRetry={() => receivedRequestsQuery.refetch()} />
                  ) : !receivedRequestsQuery.data?.length ? (
                    <EmptyState icon={<Mail className="size-10" />} title="Chưa có lời mời nào" />
                  ) : (
                    receivedRequestsQuery.data.map((item: FriendRequestItem) => (
                      <ListRow
                        key={item.id}
                        leading={<UserAvatar name={item.user.displayName} src={item.user.avatarUrl} />}
                        title={item.user.displayName}
                        subtitle={`@${item.user.username}`}
                        trailing={
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={
                                respondMutation.isPending &&
                                respondMutation.variables?.id === item.id
                              }
                              onClick={() =>
                                respondMutation.mutate({ id: item.id, action: "reject" })
                              }
                            >
                              Từ chối
                            </Button>
                            <Button
                              size="sm"
                              disabled={
                                respondMutation.isPending &&
                                respondMutation.variables?.id === item.id
                              }
                              onClick={() =>
                                respondMutation.mutate({ id: item.id, action: "accept" })
                              }
                            >
                              Chấp nhận
                            </Button>
                          </div>
                        }
                      />
                    ))
                  )
                ) : sentRequestsQuery.isLoading ? null : sentRequestsQuery.isError ? (
                  <ErrorState onRetry={() => sentRequestsQuery.refetch()} />
                ) : !sentRequestsQuery.data?.length ? (
                  <EmptyState icon={<Mail className="size-10" />} title="Bạn chưa gửi lời mời nào" />
                ) : (
                  sentRequestsQuery.data.map((item: FriendRequestItem) => (
                    <ListRow
                      key={item.id}
                      leading={<UserAvatar name={item.user.displayName} src={item.user.avatarUrl} />}
                      title={item.user.displayName}
                      subtitle={`@${item.user.username}`}
                      trailing={
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={cancelMutation.isPending && cancelMutation.variables === item.id}
                          onClick={() => cancelMutation.mutate(item.id)}
                        >
                          Hủy
                        </Button>
                      }
                    />
                  ))
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
