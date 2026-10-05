import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ChevronLeft,
  FileText,
  Images,
  ImagePlus,
  Link2,
  LogOut,
  Pencil,
  Search,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { ListRow } from "@/components/list-row";
import { MediaPreview } from "@/components/media-preview";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { downloadFile, formatBytes, uploadMedia } from "@/lib/media";
import { listMediaMessages, searchMessages, type Message, type MessagesPage, type SearchPage } from "@/lib/messages";
import { textPrompt } from "@/lib/text-prompt";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { formatRelativeTime } from "@/lib/format-time";
import { useAuthStore } from "@/store/auth-store";

type View = "main" | "search" | "mediaMenu" | "mediaList";

interface ConversationInfoSheetProps {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJumpToMessage: (messageId: string) => void;
}

export function ConversationInfoSheet({ conversationId, open, onOpenChange, onJumpToMessage }: ConversationInfoSheetProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("main");
  const [mediaKind, setMediaKind] = useState<"MEDIA" | "FILE">("MEDIA");

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

  // Gỡ hình nền là thao tác mất dữ liệu cài đặt của cả đoạn chat — xác nhận trước.
  const handleRemoveBackground = async () => {
    const ok = await confirm({
      title: "Gỡ hình nền?",
      description: "Hình nền của đoạn chat sẽ bị gỡ bỏ.",
      destructive: true,
      confirmLabel: "Gỡ hình nền",
    });
    if (ok) removeBackgroundMutation.mutate();
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

  const jumpAndClose = (messageId: string) => {
    onOpenChange(false);
    onJumpToMessage(messageId);
  };

  const backTo = (target: View) => () => setView(target);
  const titleByView: Record<View, string> = {
    main: "Thông tin hội thoại",
    search: "Tìm kiếm tin nhắn",
    mediaMenu: "File phương tiện và file",
    mediaList: mediaKind === "MEDIA" ? "File phương tiện" : "File",
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setView("main");
      }}
    >
      <SheetContent className="w-full gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border">
          <div className="flex items-center gap-2">
            {view !== "main" && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Quay lại"
                onClick={view === "mediaList" ? backTo("mediaMenu") : backTo("main")}
              >
                <ChevronLeft />
              </Button>
            )}
            <SheetTitle>{titleByView[view]}</SheetTitle>
          </div>
        </SheetHeader>

        {view === "main" && (
          <div className="flex flex-1 flex-col overflow-y-auto">
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
              {isGroup && <p className="text-sm text-muted-foreground">{conv?.members.length} thành viên</p>}
            </div>

            <div className="border-t border-border">
              <ListRow
                leading={<Search className="size-5 shrink-0 text-muted-foreground" />}
                title="Tìm kiếm tin nhắn"
                onClick={() => setView("search")}
              />
              <ListRow
                leading={<Images className="size-5 shrink-0 text-muted-foreground" />}
                title="File phương tiện và file"
                onClick={() => setView("mediaMenu")}
              />
            </div>

            <SectionLabel>Tùy chỉnh</SectionLabel>
            <div>
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
                      onClick={handleRemoveBackground}
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
            </div>

            {isGroup && (
              <>
                <SectionLabel>Thành viên</SectionLabel>
                <div>
                  <ListRow
                    leading={<Users className="size-5 shrink-0 text-muted-foreground" />}
                    title="Thành viên"
                    onClick={() => {
                      // Đóng sheet trước khi mở modal — để lại sheet mở phía dưới sẽ
                      // chồng 2 lớp overlay (Sheet + Dialog) nhìn rối.
                      onOpenChange(false);
                      navigate(`/group-members/${conversationId}`, { state: { background: location } });
                    }}
                  />
                  {isAdmin && (
                    <ListRow
                      leading={<Link2 className="size-5 shrink-0 text-muted-foreground" />}
                      title="Link mời"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/invite-link/${conversationId}`, { state: { background: location } });
                      }}
                    />
                  )}
                </div>
              </>
            )}

            {isGroup && (
              <>
                <SectionLabel>Quản lý và bảo mật</SectionLabel>
                <div className="mb-4">
                  <ListRow
                    leading={<LogOut className="size-5 shrink-0 text-destructive" />}
                    title="Rời nhóm"
                    destructive
                    onClick={handleLeave}
                  />
                  {isAdmin && (
                    <ListRow
                      leading={<Trash2 className="size-5 shrink-0 text-destructive" />}
                      title="Giải tán nhóm"
                      destructive
                      onClick={handleDisband}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {view === "search" && <SearchView conversationId={conversationId} onJump={jumpAndClose} />}

        {view === "mediaMenu" && (
          <div className="border-t border-border">
            <ListRow
              leading={<Images className="size-5 shrink-0 text-muted-foreground" />}
              title="File phương tiện"
              subtitle="Ảnh và video đã gửi"
              onClick={() => {
                setMediaKind("MEDIA");
                setView("mediaList");
              }}
            />
            <ListRow
              leading={<FileText className="size-5 shrink-0 text-muted-foreground" />}
              title="File"
              subtitle="Tài liệu đã gửi"
              onClick={() => {
                setMediaKind("FILE");
                setView("mediaList");
              }}
            />
          </div>
        )}

        {view === "mediaList" && (
          <MediaListView conversationId={conversationId} kind={mediaKind} onJump={jumpAndClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-4 pb-1 pt-4 text-xs font-medium text-muted-foreground">{children}</p>;
}

function SearchView({ conversationId, onJump }: { conversationId: string; onJump: (messageId: string) => void }) {
  const [text, setText] = useState("");
  const debounced = useDebouncedValue(text.trim(), 300);

  const query = useInfiniteQuery({
    queryKey: ["messages", "search", conversationId, debounced],
    queryFn: ({ pageParam }: { pageParam?: string }) => searchMessages(conversationId, debounced, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: SearchPage) => last.nextCursor ?? undefined,
    enabled: debounced.length > 0,
  });

  const hits = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border p-3">
        <Input
          autoFocus
          placeholder="Nhập từ khoá"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Từ khoá tìm kiếm"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {debounced.length === 0 ? (
          <EmptyState title="Nhập từ khoá để tìm trong đoạn chat" />
        ) : query.isError ? (
          <EmptyState title="Tìm kiếm thất bại, vui lòng thử lại" />
        ) : hits.length === 0 && !query.isLoading ? (
          <EmptyState title="Không có tin nhắn nào khớp" />
        ) : (
          <>
            {hits.map((hit) => (
              <ListRow
                key={hit.id}
                leading={<UserAvatar name={hit.sender.displayName} src={hit.sender.avatarUrl} />}
                title={hit.content ?? ""}
                subtitle={`${hit.sender.displayName} · ${formatRelativeTime(hit.createdAt)}`}
                onClick={() => onJump(hit.id)}
              />
            ))}
            <InfiniteScrollSentinel
              enabled={!!query.hasNextPage && !query.isFetchingNextPage}
              onVisible={() => query.fetchNextPage()}
            />
          </>
        )}
      </div>
    </div>
  );
}

function MediaListView({
  conversationId,
  kind,
  onJump,
}: {
  conversationId: string;
  kind: "MEDIA" | "FILE";
  onJump: (messageId: string) => void;
}) {
  const query = useInfiniteQuery({
    queryKey: ["messages", "media", conversationId, kind],
    queryFn: ({ pageParam }: { pageParam?: string }) => listMediaMessages(conversationId, kind, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: MessagesPage) => last.nextCursor ?? undefined,
  });

  const items: Message[] = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      {query.isError ? (
        <EmptyState title="Không tải được danh sách, vui lòng thử lại" />
      ) : items.length === 0 && !query.isLoading ? (
        <EmptyState title={kind === "MEDIA" ? "Chưa có ảnh hoặc video" : "Chưa có file nào"} />
      ) : kind === "MEDIA" ? (
        <div className="grid grid-cols-3 gap-1 p-1">
          {items.map((m) => (
            <MediaPreview
              key={m.id}
              url={m.mediaUrl!}
              isVideo={m.type === "VIDEO"}
              onClick={() => onJump(m.id)}
            />
          ))}
        </div>
      ) : (
        items.map((m) => (
          <ListRow
            key={m.id}
            leading={<FileText className="size-5 shrink-0 text-muted-foreground" />}
            title={m.mediaName ?? "File"}
            subtitle={`${formatBytes(m.mediaSize ?? 0)} · ${formatRelativeTime(m.createdAt)}`}
            onClick={() => downloadFile(m.mediaUrl!, m.mediaName ?? undefined)}
          />
        ))
      )}
      <InfiniteScrollSentinel
        enabled={!!query.hasNextPage && !query.isFetchingNextPage}
        onVisible={() => query.fetchNextPage()}
      />
    </div>
  );
}
