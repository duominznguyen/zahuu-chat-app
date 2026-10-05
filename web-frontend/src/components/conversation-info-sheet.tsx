import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ImagePlus,
  Link2,
  LogOut,
  Pencil,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ListRow } from "@/components/list-row";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { confirm } from "@/lib/confirm";
import {
  disbandConversation,
  getConversationDetail,
  leaveConversation,
  setNickname,
  updateBackground,
  updateConversation,
} from "@/lib/conversations";
import { uploadMedia } from "@/lib/media";
import { textPrompt } from "@/lib/text-prompt";
import { useAuthStore } from "@/store/auth-store";

export function ConversationInfoSheet({
  conversationId,
  open,
  onOpenChange,
}: {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", conversationId],
    queryFn: () => getConversationDetail(conversationId),
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["conversations", "detail", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
  };

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateConversation(conversationId, { name }),
    onSuccess: invalidate,
    onError: () => toast.error("Đổi tên thất bại, vui lòng thử lại"),
  });

  const nicknameMutation = useMutation({
    mutationFn: ({ targetId, nickname }: { targetId: string; nickname: string }) =>
      setNickname(conversationId, targetId, nickname),
    onSuccess: () => {
      toast.success("Đã đặt biệt danh");
      invalidate();
    },
    onError: () => toast.error("Đặt biệt danh thất bại, vui lòng thử lại"),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadMedia(file, "GROUP_AVATAR");
      return updateConversation(conversationId, { avatarUrl: uploaded.url });
    },
    onSuccess: invalidate,
    onError: () => toast.error("Đổi ảnh đại diện thất bại, vui lòng thử lại"),
  });

  const backgroundMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadMedia(file, "BACKGROUND");
      return updateBackground(conversationId, uploaded.url);
    },
    onSuccess: invalidate,
    onError: () => toast.error("Đổi hình nền thất bại, vui lòng thử lại"),
  });

  const removeBackgroundMutation = useMutation({
    mutationFn: () => updateBackground(conversationId, null),
    onSuccess: invalidate,
    onError: () => toast.error("Gỡ hình nền thất bại, vui lòng thử lại"),
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveConversation(conversationId),
    onSuccess: () => {
      onOpenChange(false);
      navigate("/chat");
      queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
    },
    onError: () => toast.error("Rời nhóm thất bại, vui lòng thử lại"),
  });

  const disbandMutation = useMutation({
    mutationFn: () => disbandConversation(conversationId),
    onSuccess: () => {
      onOpenChange(false);
      navigate("/chat");
      queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
    },
    onError: () => toast.error("Giải tán nhóm thất bại, vui lòng thử lại"),
  });

  const conv = detailQuery.data;
  const isGroup = conv?.type === "GROUP";
  const isAdmin = conv?.role === "ADMIN";
  const otherMember = conv?.members.find((m) => m.id !== myId);

  const handleRename = async () => {
    const value = await textPrompt({
      title: "Đổi tên nhóm",
      initialValue: conv?.name ?? "",
      maxLength: 100,
    });
    if (value) renameMutation.mutate(value);
  };

  const handleSetNickname = async () => {
    if (!otherMember) return;
    const value = await textPrompt({
      title: `Đặt biệt danh cho ${otherMember.displayName}`,
      initialValue: otherMember.nickname ?? otherMember.displayName,
      maxLength: 50,
    });
    if (value) nicknameMutation.mutate({ targetId: otherMember.id, nickname: value });
  };

  const handleLeave = async () => {
    const ok = await confirm({ title: "Rời nhóm?", destructive: true, confirmLabel: "Rời nhóm" });
    if (ok) leaveMutation.mutate();
  };

  const handleDisband = async () => {
    const ok = await confirm({
      title: "Giải tán nhóm?",
      description: "Hành động này không thể hoàn tác. Toàn bộ tin nhắn sẽ bị xóa vĩnh viễn.",
      destructive: true,
      confirmLabel: "Giải tán",
    });
    if (ok) disbandMutation.mutate();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Thông tin hội thoại</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col items-center gap-2 py-6">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            aria-label="Chọn ảnh đại diện nhóm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) avatarMutation.mutate(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={!isGroup || !isAdmin}
            className="relative"
            onClick={() => avatarInputRef.current?.click()}
          >
            <UserAvatar name={conv?.name ?? "?"} src={conv?.avatarUrl} size="lg" />
            {isGroup && isAdmin && (
              <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Camera className="size-3" />
              </span>
            )}
          </button>
          <p className="text-lg font-semibold text-foreground">{conv?.name ?? "..."}</p>
          {isGroup && (
            <p className="text-sm text-muted-foreground">{conv?.members.length} thành viên</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto border-t border-border">
          {isGroup && isAdmin && (
            <ListRow
              leading={<Pencil className="size-5 shrink-0 text-muted-foreground" />}
              title="Đổi tên nhóm"
              onClick={handleRename}
            />
          )}

          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/*"
            aria-label="Chọn ảnh hình nền"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) backgroundMutation.mutate(file);
              e.target.value = "";
            }}
          />
          <ListRow
            leading={<ImagePlus className="size-5 shrink-0 text-muted-foreground" />}
            title="Đổi hình nền"
            onClick={() => backgroundInputRef.current?.click()}
            trailing={
              conv?.backgroundUrl ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Gỡ hình nền"
                  onClick={() => removeBackgroundMutation.mutate()}
                >
                  <X />
                </Button>
              ) : undefined
            }
          />

          {!isGroup && (
            <ListRow
              leading={<Tag className="size-5 shrink-0 text-muted-foreground" />}
              title="Đặt biệt danh"
              onClick={handleSetNickname}
            />
          )}

          {isGroup && (
            <ListRow
              leading={<Users className="size-5 shrink-0 text-muted-foreground" />}
              title="Thành viên"
              onClick={() => {
                // Đóng sheet trước khi mở modal — để lại sheet mở phía dưới sẽ
                // chồng 2 lớp overlay (Sheet + Dialog) nhìn rối, không giống ý
                // định "thay thế bằng modal con" của mobile (push screen mới).
                onOpenChange(false);
                navigate(`/group-members/${conversationId}`, { state: { background: location } });
              }}
            />
          )}

          {isGroup && isAdmin && (
            <ListRow
              leading={<Link2 className="size-5 shrink-0 text-muted-foreground" />}
              title="Link mời"
              onClick={() => {
                onOpenChange(false);
                navigate(`/invite-link/${conversationId}`, { state: { background: location } });
              }}
            />
          )}

          {isGroup && (
            <ListRow
              leading={<LogOut className="size-5 shrink-0 text-destructive" />}
              title="Rời nhóm"
              destructive
              onClick={handleLeave}
            />
          )}

          {isGroup && isAdmin && (
            <ListRow
              leading={<Trash2 className="size-5 shrink-0 text-destructive" />}
              title="Giải tán nhóm"
              destructive
              onClick={handleDisband}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
