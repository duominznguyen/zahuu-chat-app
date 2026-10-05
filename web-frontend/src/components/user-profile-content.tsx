import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState } from "@/components/error-state";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createDirectConversation } from "@/lib/conversations";
import { confirm } from "@/lib/confirm";
import {
  blockUser,
  getUserProfile,
  sendFriendRequest,
  unblockUser,
  unfriend,
} from "@/lib/friends";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

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

  const messageMutation = useMutation({
    mutationFn: () => createDirectConversation(userId),
    onSuccess: (conv) => navigate(`/chat/${conv.id}`),
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

  return (
    <div className="flex flex-col items-center gap-3 p-6">
      <UserAvatar name={user.displayName} src={user.avatarUrl} size="lg" />
      <div className="flex flex-col items-center gap-1">
        <p className="text-xl font-semibold text-foreground">{user.displayName}</p>
        <p className="text-muted-foreground">@{user.username}</p>
      </div>
      {user.bio && <p className="text-center text-sm text-foreground">{user.bio}</p>}
      {user.birthday && (
        <p className="text-sm text-muted-foreground">
          Sinh ngày {new Date(user.birthday).toLocaleDateString("vi-VN")}
        </p>
      )}
      {user.gender && (
        <p className="text-sm text-muted-foreground">
          {GENDER_LABEL[user.gender] ?? user.gender}
        </p>
      )}

      <div className="flex w-full max-w-xs flex-col gap-3 pt-4">
        {status === "friends" && (
          <>
            <Button disabled={messageMutation.isPending} onClick={() => messageMutation.mutate()}>
              {messageMutation.isPending && <Loader2 className="animate-spin" />}
              Nhắn tin
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Thêm tùy chọn</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Hủy kết bạn?",
                      destructive: true,
                      confirmLabel: "Hủy kết bạn",
                    });
                    if (ok) unfriendMutation.mutate();
                  }}
                >
                  Hủy kết bạn
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Chặn người này?",
                      destructive: true,
                      confirmLabel: "Chặn",
                    });
                    if (ok) blockMutation.mutate();
                  }}
                >
                  Chặn
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {status === "none" && (
          <Button
            disabled={sendRequestMutation.isPending}
            onClick={() => sendRequestMutation.mutate()}
          >
            {sendRequestMutation.isPending && <Loader2 className="animate-spin" />}
            Kết bạn
          </Button>
        )}

        {status === "pending_sent" && <Button disabled>Đã gửi lời mời</Button>}

        {status === "pending_received" && (
          <>
            <p className="text-center text-sm text-muted-foreground">
              {user.displayName} đã gửi cho bạn lời mời kết bạn
            </p>
            <Button onClick={() => navigate("/friends?tab=requests")}>
              Xem lời mời kết bạn
            </Button>
          </>
        )}

        {status === "blocked" && (
          <Button
            variant="secondary"
            disabled={unblockMutation.isPending}
            onClick={async () => {
              const ok = await confirm({ title: "Bỏ chặn?" });
              if (ok) unblockMutation.mutate();
            }}
          >
            {unblockMutation.isPending && <Loader2 className="animate-spin" />}
            Bỏ chặn
          </Button>
        )}
      </div>
    </div>
  );
}
