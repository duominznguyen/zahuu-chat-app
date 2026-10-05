import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { ListRow } from "@/components/list-row";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError } from "@/lib/api-client";
import { addMember, getConversationDetail } from "@/lib/conversations";
import { listFriends, type FriendItem } from "@/lib/friends";

type RowStatus = "pending" | "adding" | "added" | "error";

export function AddMembersContent({
  conversationId,
  onDone,
}: {
  conversationId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", conversationId],
    queryFn: () => getConversationDetail(conversationId),
  });
  const existingMemberIds = new Set(detailQuery.data?.members.map((m) => m.id) ?? []);

  const friendsQuery = useInfiniteQuery({
    queryKey: ["friends", "list"],
    queryFn: ({ pageParam }: { pageParam?: string }) => listFriends(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const candidates = (friendsQuery.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (f) => !existingMemberIds.has(f.user.id),
  );

  const toggle = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      setSubmitting(true);
      let hadError = false;
      // Bỏ qua người đã thêm thành công ở lần bấm trước (cho phép bấm lại để
      // retry riêng những người bị lỗi mà không gửi trùng request đã thành công).
      const targets = Array.from(selectedIds).filter((userId) => statuses[userId] !== "added");
      for (const userId of targets) {
        setStatuses((s) => ({ ...s, [userId]: "adding" }));
        try {
          await addMember(conversationId, userId);
          setStatuses((s) => ({ ...s, [userId]: "added" }));
        } catch (e) {
          hadError = true;
          setStatuses((s) => ({ ...s, [userId]: "error" }));
          setErrors((er) => ({
            ...er,
            [userId]: e instanceof ApiError ? e.message : "Thêm thất bại, vui lòng thử lại",
          }));
        }
      }
      return { hadError };
    },
    onSettled: () => {
      setSubmitting(false);
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail", conversationId] });
    },
  });

  const selectedCount = selectedIds.size;
  const canSubmit = selectedCount > 0 && !submitting;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {friendsQuery.isLoading || detailQuery.isLoading ? null : friendsQuery.isError ? (
          <ErrorState onRetry={() => friendsQuery.refetch()} />
        ) : candidates.length === 0 ? (
          <EmptyState icon={<UserPlus className="size-10" />} title="Không còn bạn bè nào để thêm" />
        ) : (
          <>
            {candidates.map((item: FriendItem) => {
              const status = statuses[item.user.id] ?? "pending";
              const checked = selectedIds.has(item.user.id);
              return (
                <div key={item.friendshipId}>
                  <ListRow
                    leading={<UserAvatar name={item.user.displayName} src={item.user.avatarUrl} />}
                    title={item.user.displayName}
                    subtitle={`@${item.user.username}`}
                    onClick={status === "pending" ? () => toggle(item.user.id) : undefined}
                    trailing={
                      status === "adding" ? (
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      ) : status === "added" ? (
                        <Check className="size-5 text-success" />
                      ) : status === "error" ? (
                        <AlertCircle className="size-5 text-danger" />
                      ) : (
                        <Checkbox checked={checked} onCheckedChange={() => toggle(item.user.id)} />
                      )
                    }
                  />
                  {status === "error" && errors[item.user.id] && (
                    <p className="-mt-1 px-4 pb-2 text-xs text-danger">{errors[item.user.id]}</p>
                  )}
                </div>
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
        <Button
          className="w-full"
          disabled={!canSubmit}
          onClick={async () => {
            const { hadError } = await addMutation.mutateAsync();
            // Còn ít nhất 1 người thất bại -> ở lại để người dùng thấy rõ lỗi
            // của từng người (chỉ tự đóng khi thêm thành công hết).
            if (!hadError) onDone();
          }}
        >
          {submitting && <Loader2 className="animate-spin" />}
          {selectedCount > 0 ? `Thêm (${selectedCount})` : "Thêm"}
        </Button>
      </div>
    </div>
  );
}
