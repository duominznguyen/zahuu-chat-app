import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { ListRow } from "@/components/list-row";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { createGroupConversation } from "@/lib/conversations";
import { listFriends, type FriendItem } from "@/lib/friends";

const MAX_MEMBERS = 250;

export function CreateGroupContent({ onCreated }: { onCreated: (conversationId: string) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const friendsQuery = useInfiniteQuery({
    queryKey: ["friends", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listFriends(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const friends = friendsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const createMutation = useMutation({
    mutationFn: () => createGroupConversation(name.trim(), Array.from(selectedIds)),
    onSuccess: (conv) => {
      // Không chờ socket group:memberAdded round-trip cho chính hành động của
      // mình — tự invalidate ngay, đơn giản và chắc chắn hơn.
      queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
      onCreated(conv.id);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Tạo nhóm thất bại, vui lòng thử lại");
    },
  });

  const toggle = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else if (next.size < MAX_MEMBERS) next.add(userId);
      return next;
    });
  };

  const canSubmit = name.trim().length > 0 && selectedIds.size > 0 && !createMutation.isPending;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 p-4">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="Nhập tên nhóm"
        />
        <p className="text-sm text-muted-foreground">
          Đã chọn {selectedIds.size}/{MAX_MEMBERS} thành viên
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {friendsQuery.isLoading ? null : friendsQuery.isError ? (
          <ErrorState onRetry={() => friendsQuery.refetch()} />
        ) : friends.length === 0 ? (
          <EmptyState icon={<Users className="size-10" />} title="Bạn chưa có bạn bè nào để thêm" />
        ) : (
          <>
            {friends.map((item: FriendItem) => {
              const checked = selectedIds.has(item.user.id);
              const disabled = !checked && selectedIds.size >= MAX_MEMBERS;
              return (
                <ListRow
                  key={item.friendshipId}
                  leading={<UserAvatar name={item.user.displayName} src={item.user.avatarUrl} />}
                  title={item.user.displayName}
                  subtitle={`@${item.user.username}`}
                  onClick={disabled ? undefined : () => toggle(item.user.id)}
                  trailing={
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => toggle(item.user.id)}
                    />
                  }
                />
              );
            })}
            <InfiniteScrollSentinel
              enabled={!!friendsQuery.hasNextPage && !friendsQuery.isFetchingNextPage}
              onVisible={() => friendsQuery.fetchNextPage()}
            />
          </>
        )}
      </div>

      <div className="border-t border-border p-4">
        <Button className="w-full" disabled={!canSubmit} onClick={() => createMutation.mutate()}>
          {createMutation.isPending && <Loader2 className="animate-spin" />}
          Tạo nhóm
        </Button>
      </div>
    </div>
  );
}
