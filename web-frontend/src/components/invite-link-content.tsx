import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { Button } from "@/components/ui/button";
import { confirm } from "@/lib/confirm";
import { createInviteLink, listInviteLinks, revokeInviteLink, type InviteLink } from "@/lib/conversations";

function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

async function copyLink(token: string) {
  await navigator.clipboard.writeText(inviteUrl(token));
  toast.success("Đã sao chép link");
}

export function InviteLinkContent({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", "invite-links", conversationId],
    queryFn: () => listInviteLinks(conversationId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["conversations", "invite-links", conversationId] });

  const createMutation = useMutation({
    mutationFn: () => createInviteLink(conversationId),
    onSuccess: async (link) => {
      invalidate();
      await copyLink(link.token);
      toast.success("Đã tạo link mới và sao chép vào bộ nhớ tạm");
    },
    onError: () => toast.error("Tạo link thất bại, vui lòng thử lại"),
  });

  const revokeMutation = useMutation({
    mutationFn: (linkId: string) => revokeInviteLink(conversationId, linkId),
    onSuccess: () => {
      toast.success("Đã thu hồi link");
      invalidate();
    },
    onError: () => toast.error("Thu hồi thất bại, vui lòng thử lại"),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm text-muted-foreground">Bất kỳ ai có link đều tham gia được, kể cả người lạ.</p>
        <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending && <Loader2 className="animate-spin" />}
          Tạo link mới
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.isLoading ? null : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : !query.data?.length ? (
          <EmptyState icon={<Link2 className="size-10" />} title="Chưa có link mời nào" />
        ) : (
          query.data.map((item: InviteLink) => (
            <ListRow
              key={item.id}
              leading={<Link2 className="size-5 shrink-0 text-muted-foreground" />}
              title={inviteUrl(item.token)}
              subtitle={`Tạo lúc ${new Date(item.createdAt).toLocaleString("vi-VN")}`}
              onClick={() => copyLink(item.token)}
              trailing={
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => copyLink(item.token)}>
                    Copy
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={revokeMutation.isPending && revokeMutation.variables === item.id}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Thu hồi link này?",
                        description: "Ai đang cầm link này sẽ không join được nữa.",
                        destructive: true,
                        confirmLabel: "Thu hồi",
                      });
                      if (ok) revokeMutation.mutate(item.id);
                    }}
                  >
                    Thu hồi
                  </Button>
                </div>
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
