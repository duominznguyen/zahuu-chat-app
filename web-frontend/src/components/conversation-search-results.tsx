import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { ListRow } from "@/components/list-row";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError } from "@/lib/api-client";
import { createDirectConversation, searchConversations } from "@/lib/conversations";
import {
  listFriends,
  searchFriendsByName,
  searchUsersByUsername,
  type PublicUser,
} from "@/lib/friends";
import { useDebouncedValue } from "@/lib/use-debounced-value";

function openChatErrorMessage(err: unknown) {
  if (err instanceof ApiError) {
    const code = (err.body as { code?: string } | undefined)?.code;
    if (code === "BLOCKED_BY_YOU") return "Bạn đã chặn người này, hãy bỏ chặn trước khi nhắn tin";
    if (err.status === 404) return "Không tìm thấy người dùng";
  }
  return "Không mở được đoạn chat, vui lòng thử lại";
}

function SectionLabel({ children }: { children: string }) {
  return <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">{children}</p>;
}

function UserRow({
  user,
  pending,
  onPick,
}: {
  user: PublicUser;
  pending: boolean;
  onPick: (user: PublicUser) => void;
}) {
  return (
    <ListRow
      leading={<UserAvatar name={user.displayName} src={user.avatarUrl} />}
      title={user.displayName}
      subtitle={`@${user.username}`}
      onClick={() => onPick(user)}
      trailing={pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : undefined}
    />
  );
}

// Ô trống → danh sách bạn bè; gõ chữ thường → tìm bạn bè theo tên + nhóm và
// chat 1-1 với người chưa kết bạn mình đang có; gõ @ → tìm username công khai.
export function ConversationSearchResults({
  searchText,
  onPicked,
}: {
  searchText: string;
  onPicked: () => void;
}) {
  const navigate = useNavigate();
  const debounced = useDebouncedValue(searchText.trim(), 300);
  const isUsernameMode = debounced.startsWith("@");
  const usernameQuery = isUsernameMode ? debounced.slice(1) : "";
  const nameQuery = isUsernameMode ? "" : debounced;

  const friendsQuery = useInfiniteQuery({
    queryKey: ["friends", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listFriends(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: debounced.length === 0,
  });

  // ≥3 ký tự sau @ khớp giới hạn/rate limit của backend.
  const usernameSearchQuery = useQuery({
    queryKey: ["users", "search", usernameQuery],
    queryFn: () => searchUsersByUsername(usernameQuery),
    enabled: isUsernameMode && usernameQuery.length >= 3,
  });

  const nameSearchQuery = useQuery({
    queryKey: ["friends", "search", nameQuery],
    queryFn: () => searchFriendsByName(nameQuery),
    enabled: nameQuery.length >= 1,
  });

  const conversationSearchQuery = useQuery({
    queryKey: ["conversations", "search", nameQuery],
    queryFn: () => searchConversations(nameQuery),
    enabled: nameQuery.length >= 1,
  });

  const openChatMutation = useMutation({
    mutationFn: (user: PublicUser) => createDirectConversation(user.id),
    onSuccess: (conv) => {
      onPicked();
      navigate(`/chat/${conv.id}`);
    },
    onError: (err) => toast.error(openChatErrorMessage(err)),
  });

  const pick = (user: PublicUser) => {
    if (!openChatMutation.isPending) openChatMutation.mutate(user);
  };
  const renderRow = (user: PublicUser) => (
    <UserRow
      key={user.id}
      user={user}
      pending={openChatMutation.isPending && openChatMutation.variables?.id === user.id}
      onPick={pick}
    />
  );

  if (isUsernameMode) {
    if (usernameQuery.length < 3) {
      return (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Nhập ít nhất 3 ký tự sau @ để tìm
        </p>
      );
    }
    if (usernameSearchQuery.isLoading) return null;
    if (usernameSearchQuery.isError) return <ErrorState onRetry={() => usernameSearchQuery.refetch()} />;
    if (!usernameSearchQuery.data?.length) {
      return <EmptyState icon={<Search className="size-10" />} title="Không tìm thấy ai" />;
    }
    return <>{usernameSearchQuery.data.map(renderRow)}</>;
  }

  if (nameQuery) {
    if (nameSearchQuery.isLoading || conversationSearchQuery.isLoading) return null;
    if (nameSearchQuery.isError || conversationSearchQuery.isError) {
      return (
        <ErrorState
          onRetry={() => {
            void nameSearchQuery.refetch();
            void conversationSearchQuery.refetch();
          }}
        />
      );
    }
    const friendResults = nameSearchQuery.data ?? [];
    const groupResults = conversationSearchQuery.data?.groups ?? [];
    const strangerResults = conversationSearchQuery.data?.directs ?? [];
    const openConversation = (conversationId: string) => {
      onPicked();
      navigate(`/chat/${conversationId}`);
    };
    if (friendResults.length === 0 && groupResults.length === 0 && strangerResults.length === 0) {
      return (
        <EmptyState
          icon={<Search className="size-10" />}
          title="Không tìm thấy đoạn chat nào"
          description="Gõ @username để tìm người chưa kết bạn"
        />
      );
    }
    return (
      <>
        {friendResults.length > 0 && (
          <>
            <SectionLabel>Bạn bè</SectionLabel>
            {friendResults.map(renderRow)}
          </>
        )}
        {groupResults.length > 0 && (
          <>
            <SectionLabel>Nhóm</SectionLabel>
            {groupResults.map((group) => (
              <ListRow
                key={group.id}
                leading={<UserAvatar name={group.name ?? "?"} src={group.avatarUrl} />}
                title={group.name ?? "Nhóm"}
                subtitle={`${group.memberCount} thành viên`}
                onClick={() => openConversation(group.id)}
              />
            ))}
          </>
        )}
        {strangerResults.length > 0 && (
          <>
            <SectionLabel>Người chưa kết bạn</SectionLabel>
            {strangerResults.map((chat) => (
              <ListRow
                key={chat.id}
                leading={<UserAvatar name={chat.name} src={chat.avatarUrl} />}
                title={chat.name}
                subtitle={`@${chat.otherUser.username}`}
                onClick={() => openConversation(chat.id)}
              />
            ))}
          </>
        )}
      </>
    );
  }

  const friends = friendsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  if (friendsQuery.isLoading) return null;
  if (friendsQuery.isError) return <ErrorState onRetry={() => friendsQuery.refetch()} />;
  if (friends.length === 0) {
    return (
      <EmptyState
        icon={<Users className="size-10" />}
        title="Chưa có bạn bè nào"
        description="Gõ @username để tìm người khác"
      />
    );
  }
  return (
    <>
      <SectionLabel>Bạn bè</SectionLabel>
      {friends.map((item) => renderRow(item.user))}
      <InfiniteScrollSentinel
        enabled={!!friendsQuery.hasNextPage && !friendsQuery.isFetchingNextPage}
        onVisible={() => friendsQuery.fetchNextPage()}
      />
    </>
  );
}
