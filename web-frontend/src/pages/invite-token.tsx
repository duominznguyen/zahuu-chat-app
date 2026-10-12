import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/error-state";
import { ApiError } from "@/lib/api-client";
import { joinByInviteToken, previewInviteLink } from "@/lib/conversations";

// Màn xem trước nhóm trước khi join (mở từ link mời) — không join thẳng ngay
// khi mở link, phải xác nhận giống Zalo: tự ý thêm người vào nhóm mà không
// hỏi là trải nghiệm xấu (quyết định đã áp dụng y hệt ở mobile).
export default function InviteToken() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // staleTime/gcTime = 0: trạng thái "đã là thành viên chưa" đổi liên tục
  // (rời/join nhóm) nên không được dùng cache mặc định 30s của app — rời
  // nhóm rồi bấm lại link ngay sẽ đọc nhầm kết quả cũ (bug thật đã xảy ra ở
  // mobile, xem CLAUDE.md).
  const previewQuery = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => previewInviteLink(token!),
    enabled: !!token,
    staleTime: 0,
    gcTime: 0,
  });

  // Đã là thành viên rồi -> vào thẳng luôn, không có gì để xác nhận thêm.
  // Khác mobile: không cần tham số `from` để tự nhận biết "đang xem đúng
  // nhóm này" vì React Router không giữ lại instance route cũ nào bên dưới
  // (khác Expo Router), replace() ở đây luôn an toàn.
  useEffect(() => {
    if (!previewQuery.data?.alreadyMember) return;
    navigate(`/chat/${previewQuery.data.conversationId}`, { replace: true });
  }, [previewQuery.data, navigate]);

  // Link mời thường được mở trực tiếp (dán URL/click từ ngoài app), nên
  // không chắc có lịch sử điều hướng nội bộ để `navigate(-1)` lùi về —
  // `history.state.idx` (React Router tự gắn) > 0 mới chắc chắn còn trang
  // trước đó trong CHÍNH app này.
  const handleCancel = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/chat", { replace: true });
  };

  const joinMutation = useMutation({
    mutationFn: () => joinByInviteToken(token!),
    onSuccess: (conv) => {
      toast.success(`Đã tham gia nhóm ${conv.name ?? ""}`);
      // Chủ động invalidate thay vì chỉ chờ socket group:memberAdded — danh
      // sách hội thoại có thể chưa từng mở nên chưa kịp lắng nghe event đó.
      queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
      navigate(`/chat/${conv.id}`, { replace: true });
    },
    onError: () => toast.error("Tham gia nhóm thất bại, vui lòng thử lại"),
  });

  if (previewQuery.isLoading || previewQuery.data?.alreadyMember) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (previewQuery.isError) {
    const title =
      previewQuery.error instanceof ApiError && previewQuery.error.status === 404
        ? "Link mời không hợp lệ hoặc đã bị thu hồi"
        : "Không tải được thông tin nhóm, vui lòng thử lại";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <ErrorState title={title} onRetry={() => previewQuery.refetch()} />
      </div>
    );
  }

  const preview = previewQuery.data;
  if (!preview) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-8">
      <Avatar size="lg" className="size-24">
        <AvatarImage src={preview.avatarUrl ?? undefined} alt={preview.name} />
        <AvatarFallback className="text-2xl">
          {preview.name.trim().slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-center gap-1">
        <p className="text-xl font-semibold text-foreground">{preview.name}</p>
        <p className="text-muted-foreground">{preview.memberCount} thành viên</p>
      </div>
      <p className="text-center text-muted-foreground">Bạn được mời tham gia nhóm này</p>

      <div className="flex w-full max-w-xs flex-col gap-3 pt-4">
        <Button disabled={joinMutation.isPending} onClick={() => joinMutation.mutate()}>
          {joinMutation.isPending && <Loader2 className="animate-spin" />}
          Tham gia nhóm
        </Button>
        <Button variant="secondary" disabled={joinMutation.isPending} onClick={handleCancel}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}
