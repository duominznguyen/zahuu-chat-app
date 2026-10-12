import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { confirm } from "@/lib/confirm";
import { listBlocked, unblockUser, type BlockedUser } from "@/lib/friends";

export default function SettingsBlocked() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["blocks"], queryFn: listBlocked });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => {
      toast.success("Đã bỏ chặn");
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  const handleUnblock = async (item: BlockedUser) => {
    const ok = await confirm({
      title: "Bỏ chặn?",
      description: `${item.displayName} sẽ có thể tìm và kết bạn với bạn lại.`,
      confirmLabel: "Bỏ chặn",
    });
    if (ok) unblockMutation.mutate(item.id);
  };

  if (query.isLoading) return null;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Danh sách chặn</h1>
      {!query.data?.length ? (
        <EmptyState title="Chưa chặn ai" />
      ) : (
        <div className="-mx-4 flex flex-col">
          {query.data.map((item) => (
            <ListRow
              key={item.id}
              leading={<UserAvatar name={item.displayName} src={item.avatarUrl} />}
              title={item.displayName}
              subtitle={`@${item.username}`}
              trailing={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unblockMutation.isPending && unblockMutation.variables === item.id}
                  onClick={() => handleUnblock(item)}
                >
                  Bỏ chặn
                </Button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
