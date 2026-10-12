import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Tag,
  UserMinus,
  UserPlus,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState } from "@/components/error-state";
import { ListRow } from "@/components/list-row";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api-client";
import { rootBackground } from "@/lib/background-location";
import { confirm } from "@/lib/confirm";
import {
  getConversationDetail,
  removeMember,
  setNickname,
  updateMemberRole,
  type ConversationMember,
} from "@/lib/conversations";
import { textPrompt } from "@/lib/text-prompt";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";

export function GroupMembersContent({
  conversationId,
  onOpenAddMembers,
  onClose,
}: {
  conversationId: string;
  onOpenAddMembers: () => void;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", conversationId],
    queryFn: () => getConversationDetail(conversationId),
  });

  const invalidateDetail = () =>
    queryClient.invalidateQueries({ queryKey: ["conversations", "detail", conversationId] });

  useEffect(() => {
    if (!socket) return;
    const refresh = () => invalidateDetail();
    socket.on("group:memberAdded", refresh);
    socket.on("group:memberRemoved", refresh);
    socket.on("group:updated", refresh);
    return () => {
      socket.off("group:memberAdded", refresh);
      socket.off("group:memberRemoved", refresh);
      socket.off("group:updated", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversationId]);

  const nicknameMutation = useMutation({
    mutationFn: ({ userId, nickname }: { userId: string; nickname: string }) =>
      setNickname(conversationId, userId, nickname),
    onSuccess: () => {
      toast.success("Đã đặt biệt danh");
      invalidateDetail();
    },
    onError: () => toast.error("Đặt biệt danh thất bại, vui lòng thử lại"),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "ADMIN" | "MEMBER" }) =>
      updateMemberRole(conversationId, userId, role),
    onSuccess: (_res, { role }) => {
      toast.success(role === "ADMIN" ? "Đã thăng làm admin" : "Đã giáng chức");
      invalidateDetail();
    },
    onError: (e) => {
      toast.error(
        e instanceof ApiError && e.status === 409
          ? "Không thể giáng chức vì không còn ai thay thế"
          : "Thao tác thất bại, vui lòng thử lại",
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(conversationId, userId),
    onSuccess: () => {
      toast.success("Đã xóa khỏi nhóm");
      invalidateDetail();
    },
    onError: () => toast.error("Xóa thất bại, vui lòng thử lại"),
  });

  if (detailQuery.isError) {
    return <ErrorState onRetry={() => detailQuery.refetch()} />;
  }

  const members = detailQuery.data?.members ?? [];
  const iAmAdmin = detailQuery.data?.role === "ADMIN";

  const openProfile = (userId: string) => {
    navigate(`/u/${userId}`, { state: { background: rootBackground(location) } });
  };

  const handleSetNickname = async (member: ConversationMember) => {
    const value = await textPrompt({
      title: `Đặt biệt danh cho ${member.displayName}`,
      initialValue: member.nickname ?? member.displayName,
      maxLength: 50,
    });
    if (value) nicknameMutation.mutate({ userId: member.id, nickname: value });
  };

  const handleRemove = async (member: ConversationMember) => {
    const ok = await confirm({
      title: "Xóa khỏi nhóm?",
      description: `${member.nickname ?? member.displayName} sẽ không còn trong nhóm này.`,
      destructive: true,
      confirmLabel: "Xóa",
    });
    if (ok) removeMutation.mutate(member.id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-medium text-foreground">Thành viên ({members.length})</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Thêm thành viên" onClick={onOpenAddMembers}>
            <UserPlus />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon-sm" aria-label="Đóng" onClick={onClose}>
              <X />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {members.map((member) => (
          <ListRow
            key={member.id}
            leading={<UserAvatar name={member.displayName} src={member.avatarUrl} />}
            title={member.nickname ?? member.displayName}
            subtitle={`@${member.username}`}
            onClick={() => openProfile(member.id)}
            trailing={
              <div className="flex items-center gap-2">
                {member.role === "ADMIN" && <Badge variant="secondary">Admin</Badge>}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Thêm tùy chọn thành viên">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSetNickname(member)}>
                      <Tag />
                      Đặt biệt danh
                    </DropdownMenuItem>
                    {iAmAdmin &&
                      member.id !== myId &&
                      (member.role === "ADMIN" ? (
                        <DropdownMenuItem
                          onClick={() => roleMutation.mutate({ userId: member.id, role: "MEMBER" })}
                        >
                          <ArrowDownCircle />
                          Giáng xuống thành viên
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => roleMutation.mutate({ userId: member.id, role: "ADMIN" })}
                        >
                          <ArrowUpCircle />
                          Thăng làm admin
                        </DropdownMenuItem>
                      ))}
                    {iAmAdmin && member.id !== myId && (
                      <DropdownMenuItem variant="destructive" onClick={() => handleRemove(member)}>
                        <UserMinus />
                        Xóa khỏi nhóm
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}
