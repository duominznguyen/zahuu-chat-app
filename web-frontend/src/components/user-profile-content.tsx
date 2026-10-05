import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Inbox, Loader2, MessageCircle, Phone, ShieldOff, UserMinus, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { beginCall } from "@/lib/call-actions";
import { confirm } from "@/lib/confirm";
import { createDirectConversation } from "@/lib/conversations";
import {
  blockUser,
  cancelFriendRequest,
  getUserProfile,
  listFriendRequests,
  sendFriendRequest,
  unblockUser,
  unfriend,
} from "@/lib/friends";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

// Ngày sinh/giới tính bị backend bỏ khỏi response khi chưa là bạn (undefined), khác với
// null là "chưa cập nhật" — nên vẫn giữ nhãn nhưng che giá trị bằng ký tự ẩn.
const HIDDEN_VALUE = "••••••••";

export function UserProfileContent({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["users", "profile", userId],
    queryFn: () => getUserProfile(userId),
  });

  const invalidateProfile = () => {
    queryClient.invalidateQueries({ queryKey: ["users", "profile", userId] });
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
  };

  const sendRequestMutation = useMutation({
    mutationFn: () => sendFriendRequest(userId),
    onSuccess: () => {
      toast.success("Đã gửi lời mời kết bạn");
      invalidateProfile();
    },
  });

  // Profile không trả id lời mời, nên tra trong danh sách đã gửi để huỷ đúng lời mời này.
  const cancelRequestMutation = useMutation({
    mutationFn: async () => {
      const sent = await queryClient.fetchQuery({
        queryKey: ["friend-requests", "sent"],
        queryFn: () => listFriendRequests("sent"),
      });
      const request = sent.find((r) => r.user.id === userId);
      if (!request) throw new Error("Không tìm thấy lời mời");
      return cancelFriendRequest(request.id);
    },
    onSuccess: () => {
      toast.success("Đã hủy lời mời kết bạn");
      invalidateProfile();
    },
    onError: () => toast.error("Hủy lời mời thất bại, vui lòng thử lại"),
  });

  const unfriendMutation = useMutation({
    mutationFn: () => unfriend(userId),
    onSuccess: () => {
      toast.success("Đã hủy kết bạn");
      invalidateProfile();
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => blockUser(userId),
    onSuccess: () => {
      toast.success("Đã chặn");
      invalidateProfile();
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(userId),
    onSuccess: () => {
      toast.success("Đã bỏ chặn");
      invalidateProfile();
    },
  });

  // Nhắn tin và gọi điện đều cần conversation DIRECT — tạo (hoặc lấy lại) rồi mở chat.
  const openDirectMutation = useMutation({
    mutationFn: () => createDirectConversation(userId),
    onSuccess: (conv) => navigate(`/chat/${conv.id}`),
    onError: () => toast.error("Không mở được đoạn chat, vui lòng thử lại"),
  });

  const startCallMutation = useMutation({
    mutationFn: () => createDirectConversation(userId),
    onSuccess: (conv) => {
      navigate(`/chat/${conv.id}`);
      void beginCall(conv.id, "AUDIO");
    },
    onError: () => toast.error("Không bắt đầu được cuộc gọi, vui lòng thử lại"),
  });

  if (query.isLoading) {
    return (
      <div className="flex min-h-50 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="min-h-50">
        <ErrorState onRetry={() => query.refetch()} />
      </div>
    );
  }

  const user = query.data;
  const status = user.relationshipStatus;
  const isFriend = status === "friends";
  const isSelf = status === "self";

  const birthdayValue =
    user.birthday === undefined
      ? HIDDEN_VALUE
      : user.birthday === null
        ? "Chưa cập nhật"
        : new Date(user.birthday).toLocaleDateString("vi-VN");
  const genderValue =
    user.gender === undefined
      ? HIDDEN_VALUE
      : user.gender === null
        ? "Chưa cập nhật"
        : (GENDER_LABEL[user.gender] ?? user.gender);

  const confirmUnfriend = async () => {
    const ok = await confirm({ title: "Hủy kết bạn?", destructive: true, confirmLabel: "Hủy kết bạn" });
    if (ok) unfriendMutation.mutate();
  };
  const confirmBlock = async () => {
    const ok = await confirm({ title: "Chặn người này?", destructive: true, confirmLabel: "Chặn" });
    if (ok) blockMutation.mutate();
  };

  return (
    <div className="flex flex-col">
      <div className="relative h-40 w-full bg-muted">
        {user.coverUrl && <img src={user.coverUrl} alt="" className="size-full object-cover" />}
      </div>

      <div className="-mt-12 flex flex-col items-center gap-1 px-6">
        <Avatar className="size-24 ring-4 ring-background">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName} />
          <AvatarFallback className="text-2xl">{user.displayName.trim().slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <p className="pt-2 text-xl font-semibold text-foreground">{user.displayName}</p>
        <p className="text-sm text-muted-foreground">@{user.username}</p>
      </div>

      {isFriend && (
        <div className="flex gap-3 px-6 pt-5">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={startCallMutation.isPending}
            onClick={() => startCallMutation.mutate()}
          >
            {startCallMutation.isPending ? <Loader2 className="animate-spin" /> : <Phone />}
            Gọi điện
          </Button>
          <Button
            className="flex-1"
            disabled={openDirectMutation.isPending}
            onClick={() => openDirectMutation.mutate()}
          >
            {openDirectMutation.isPending ? <Loader2 className="animate-spin" /> : <MessageCircle />}
            Nhắn tin
          </Button>
        </div>
      )}

      <div className="mt-5 border-t border-border px-6">
        <p className="pt-4 pb-1 text-xs font-medium text-muted-foreground">Thông tin cá nhân</p>
        <InfoRow label="Giới thiệu" value={user.bio ?? "Chưa cập nhật"} />
        <InfoRow label="Ngày sinh" value={birthdayValue} />
        <InfoRow label="Giới tính" value={genderValue} />
      </div>

      {!isSelf && (
        <div className="mt-4 border-t border-border">
          <p className="px-6 pt-4 pb-1 text-xs font-medium text-muted-foreground">Quản lý và bảo mật</p>

          {status === "friends" && (
            <ListRow
              leading={<UserMinus className="size-5 shrink-0 text-destructive" />}
              title="Hủy kết bạn"
              destructive
              onClick={confirmUnfriend}
            />
          )}

          {status === "none" && (
            <ListRow
              leading={<UserPlus className="size-5 shrink-0 text-muted-foreground" />}
              title="Gửi lời mời kết bạn"
              onClick={() => sendRequestMutation.mutate()}
            />
          )}

          {status === "pending_sent" && (
            <ListRow
              leading={<UserMinus className="size-5 shrink-0 text-muted-foreground" />}
              title="Hủy lời mời kết bạn"
              onClick={() => cancelRequestMutation.mutate()}
            />
          )}

          {status === "pending_received" && (
            <ListRow
              leading={<Inbox className="size-5 shrink-0 text-muted-foreground" />}
              title="Xem lời mời kết bạn"
              onClick={() => navigate("/friends?tab=requests")}
            />
          )}

          {status === "blocked" ? (
            <ListRow
              leading={<ShieldOff className="size-5 shrink-0 text-muted-foreground" />}
              title="Bỏ chặn"
              onClick={async () => {
                const ok = await confirm({ title: "Bỏ chặn?" });
                if (ok) unblockMutation.mutate();
              }}
            />
          ) : (
            <ListRow
              leading={<Ban className="size-5 shrink-0 text-destructive" />}
              title="Chặn"
              destructive
              onClick={confirmBlock}
            />
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}
