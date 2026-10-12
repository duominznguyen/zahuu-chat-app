import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DIRECT_BLOCKED_MESSAGE } from "@/lib/conversations";
import { getUserProfile, unblockUser } from "@/lib/friends";

// Thay cho ô nhập tin trong đoạn chat 1-1 khi 2 người chặn nhau. Chỉ người đã
// chặn mới thấy lý do + nút Bỏ chặn; người bị chặn chỉ thấy câu trung lập
// (profile của người chặn trả 404 với họ).
export function BlockedNotice({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["users", "profile", userId],
    queryFn: () => getUserProfile(userId),
  });
  const blockedByMe = !profileQuery.isError && profileQuery.data?.relationshipStatus === "blocked";

  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(userId),
    onSuccess: () => {
      toast.success("Đã bỏ chặn");
      queryClient.invalidateQueries({ queryKey: ["users", "profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail"] });
    },
    onError: () => toast.error("Bỏ chặn thất bại, vui lòng thử lại"),
  });

  return (
    <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <span>{blockedByMe ? "Bạn đã chặn người này" : DIRECT_BLOCKED_MESSAGE}</span>
      {blockedByMe && (
        <Button
          size="sm"
          variant="outline"
          disabled={unblockMutation.isPending}
          onClick={() => unblockMutation.mutate()}
        >
          Bỏ chặn
        </Button>
      )}
    </div>
  );
}
