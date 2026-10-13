import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, MessageCircle, Phone, Video, X } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { rootBackground } from "@/lib/background-location";
import { toast } from "sonner";
import { ChatInput } from "@/components/chat-input";
import { ConversationInfoSheet } from "@/components/conversation-info-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { BlockedNotice } from "@/components/blocked-notice";
import { FriendshipBar } from "@/components/friendship-bar";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { MediaViewer } from "@/components/media-viewer";
import { MessageBubble } from "@/components/message-bubble";
import { SeenByRow } from "@/components/seen-by-row";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError } from "@/lib/api-client";
import { confirm } from "@/lib/confirm";
import { DIRECT_BLOCKED_MESSAGE, getConversationDetail, type ConversationDetail } from "@/lib/conversations";
import { downloadFile } from "@/lib/media";
import {
  deleteMessageForMe,
  getMessagesAround,
  listMessages,
  listMessagesAfter,
  markRead,
  recallMessage,
  removeReaction,
  sendTextMessage,
  setReaction,
  type Message,
  type MessagesPage,
  type ReactionType,
} from "@/lib/messages";
import { beginCall, joinExistingCall } from "@/lib/call-actions";
import { replyPreviewLabel } from "@/lib/reply-preview";
import { useCallStore } from "@/store/call-store";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";
import { useUploadStore } from "@/store/upload-store";
import { errorCode } from "@/lib/users";

// `cursor` = trang tin cũ hơn, `after` = trang tin mới hơn, `around` = cửa sổ quanh 1 tin
// (nhảy tới tin).
type MessagesPageParam = { cursor?: string; after?: string; around?: string };
type MessagesCache = InfiniteData<MessagesPage, MessagesPageParam>;

function patchMessage(
  data: MessagesCache | undefined,
  messageId: string,
  updater: (m: Message) => Message,
): MessagesCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((m) => (m.id === messageId ? updater(m) : m)),
    })),
  };
}

// Thu hồi 1 tin phải cập nhật CẢ bản thân tin đó LẪN bất kỳ tin nào khác đang
// "trả lời" nó — replyTo là snapshot nhúng vào từng tin lúc fetch, không tự
// đồng bộ khi tin gốc đổi trạng thái sau đó.
function applyRecall(data: MessagesCache | undefined, messageId: string): MessagesCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((m) => {
        if (m.id === messageId) {
          return { ...m, isRecalled: true, content: null, reactions: [] };
        }
        if (m.replyTo?.id === messageId) {
          return { ...m, replyTo: { ...m.replyTo, content: null, isRecalled: true } };
        }
        return m;
      }),
    })),
  };
}

function removeMessageFromCache(
  data: MessagesCache | undefined,
  messageId: string,
): MessagesCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((m) => m.id !== messageId),
    })),
  };
}

function prependMessage(data: MessagesCache | undefined, message: Message): MessagesCache | undefined {
  if (!data || data.pages.length === 0) {
    return { pages: [{ items: [message], nextCursor: null }], pageParams: [{}] };
  }
  // Chặn trùng id — tin tới 2 lần (vd StrictMode / nhiều listener) không chèn
  // trùng, tránh key trùng trong list.
  if (data.pages.some((p) => p.items.some((m) => m.id === message.id))) return data;
  const pages = [...data.pages];
  pages[0] = { ...pages[0], items: [message, ...pages[0].items] };
  return { ...data, pages };
}

const TYPING_EXPIRE_MS = 5000;

// Chỉ DIRECT mới bấm được (mở hồ sơ người kia); nhóm giữ nguyên, bấm tên/avatar nhóm không làm gì.
function HeaderIdentity({
  clickable,
  onClick,
  children,
}: {
  clickable: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  if (!clickable) return <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>;
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
      {children}
    </button>
  );
}

function typingLabel(isDirect: boolean, names: string[]): string {
  if (isDirect) return "Đang nhập...";
  if (names.length === 1) return `${names[0]} đang nhập...`;
  if (names.length === 2) return `${names[0]}, ${names[1]} đang nhập...`;
  return `${names[0]} và ${names.length - 1} người khác đang nhập...`;
}

export default function Conversation() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const id = conversationId!;
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);

  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [viewerMessageId, setViewerMessageId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Tắt tạm việc tải tin mới hơn trong lúc nhảy tới 1 tin — xem handleJumpToMessage.
  const [suppressNewer, setSuppressNewer] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const dragCounter = useRef(0);
  const lastMarkedReadId = useRef<string | null>(null);
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);
  const upload = useUploadStore((s) => s.uploads[id]);

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", id],
    queryFn: () => getConversationDetail(id),
  });

  // Vào thẳng URL 1 hội thoại không còn là thành viên (vd đã bị xóa/rời/giải
  // tán, hoặc tab cũ còn mở sau khi việc đó xảy ra) trả 404 — không xử lý sẽ
  // kẹt lại màn trống (tiêu đề "...", không tin nhắn) thay vì quay về danh
  // sách như lúc nhận được đúng sự kiện qua socket (xem onMemberRemoved).
  useEffect(() => {
    if (detailQuery.error instanceof ApiError && detailQuery.error.status === 404) {
      toast.info("Hội thoại này không còn khả dụng");
      navigate("/chat");
    }
  }, [detailQuery.error, navigate]);

  // Phân trang 2 chiều: trang sau (fetchNextPage, cuộn lên) là tin CŨ hơn, trang
  // trước (fetchPreviousPage, cuộn xuống) là tin MỚI hơn — chỉ có khi đang ở
  // cửa sổ tin cũ sau khi nhảy tới 1 tin.
  const messagesQuery = useInfiniteQuery({
    queryKey: ["messages", id],
    queryFn: ({ pageParam }: { pageParam: MessagesPageParam }) => {
      if (pageParam.around) return getMessagesAround(id, pageParam.around);
      if (pageParam.after) return listMessagesAfter(id, pageParam.after);
      return listMessages(id, pageParam.cursor);
    },
    initialPageParam: {} as MessagesPageParam,
    getNextPageParam: (lastPage): MessagesPageParam | undefined =>
      lastPage.nextCursor ? { cursor: lastPage.nextCursor } : undefined,
    getPreviousPageParam: (firstPage): MessagesPageParam | undefined =>
      firstPage.hasNewer && firstPage.items[0] ? { after: firstPage.items[0].id } : undefined,
    // Khi mở hội thoại không ở trong room, socket có thể đã bỏ lỡ tin mới — cache cũ
    // sẽ khiến "đánh dấu đã đọc" gửi ID tin cũ. Luôn lấy mới để đánh dấu đúng tin mới nhất.
    staleTime: 0,
  });

  const messages = messagesQuery.data?.pages.flatMap((p) => p.items) ?? [];

  // Cửa sổ "tin cũ" sau khi nhảy tới 1 tin ngoài phần đã tải: cache chưa có tới tin mới
  // nhất. Suy thẳng từ trang đầu (mới nhất) đang có — cuộn xuống tải hết phần tin mới
  // hơn thì tự hết, không cần state riêng.
  const hasNewerWindow = !!messagesQuery.data?.pages[0]?.hasNewer;
  // Handler socket đăng ký 1 lần nên phải đọc giá trị mới nhất qua ref.
  const newerWindowRef = useRef(false);
  useEffect(() => {
    newerWindowRef.current = hasNewerWindow;
  }, [hasNewerWindow]);

  // Rời hội thoại khi đang ở cửa sổ tin cũ (đổi sang chat khác hoặc unmount): bỏ cache để
  // lần mở sau bắt đầu từ tin mới nhất — cửa sổ được lưu làm tham số trang (để refetch lúc
  // ĐANG xem giữ đúng chỗ) nên nếu giữ cache, mở lại sẽ tải lại đúng cửa sổ tin cũ đó.
  useEffect(
    () => () => {
      if (newerWindowRef.current) {
        queryClient.removeQueries({ queryKey: ["messages", id], exact: true });
      }
    },
    [id, queryClient],
  );

  // Trang tin mới hơn được chèn vào ĐÁY khung flex-col-reverse — trình duyệt giữ nguyên
  // scrollTop (tính từ đáy) nên nội dung đang xem bị đẩy lên đúng bằng chiều cao trang
  // mới (người dùng nhảy vọt tới cuối trang vừa tải). Ghi lại vị trí trước khi tải rồi
  // bù lại ngay sau khi DOM cập nhật, trước khi trình duyệt vẽ.
  const anchorBeforeNewer = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const loadNewerMessages = () => {
    const el = listRef.current;
    if (el) anchorBeforeNewer.current = { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };
    // Promise resolve TRƯỚC khi React render data mới (TanStack báo component qua một
    // nhịp hẹn giờ sau đó) — không xoá mốc ở đây khi thành công, để layout effect dùng.
    // Chỉ bỏ mốc khi lỗi, để lần cập nhật sau không bù nhầm.
    void messagesQuery.fetchPreviousPage().then((result) => {
      if (result.isError) anchorBeforeNewer.current = null;
    });
  };
  const firstPage = messagesQuery.data?.pages[0];
  useLayoutEffect(() => {
    const anchor = anchorBeforeNewer.current;
    const el = listRef.current;
    if (!anchor || !el) return;
    anchorBeforeNewer.current = null;
    el.scrollTop = anchor.scrollTop - (el.scrollHeight - anchor.scrollHeight);
  }, [firstPage]);

  // Gửi tin hoặc đính kèm file khi đang xem tin cũ: quay về tin mới nhất trước, nếu không
  // tin vừa gửi (đến qua socket) sẽ bị bỏ qua và người dùng không thấy đâu.
  const returnToLatest = async () => {
    if (!newerWindowRef.current) return;
    newerWindowRef.current = false;
    await queryClient.resetQueries({ queryKey: ["messages", id] });
    // Khung cuộn giữ nguyên vị trí cũ (đang sâu trong lịch sử) dù data đã thay — tự về
    // cuối (flex-col-reverse: scrollTop 0 là đáy).
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: 0 }));
  };

  // Bấm vào trích dẫn hoặc kết quả tìm kiếm -> cuộn tới đúng tin + tô sáng ngắn. Tin chưa
  // tải thì lấy cả cửa sổ quanh tin đó trong 1 request và thay cache bằng cửa sổ này —
  // thời gian không phụ thuộc tin cách đây bao xa.
  const handleJumpToMessage = async (messageId: string) => {
    if (!document.getElementById(`message-${messageId}`)) {
      // Cửa sổ vừa thay xong thì khung cuộn còn ở đáy — điểm kích hoạt tải tin mới hơn
      // đang lọt khung nhìn, sẽ tự tải dồn hết trước khi kịp cuộn tới tin đích.
      setSuppressNewer(true);
      try {
        const around = await getMessagesAround(id, messageId);
        // Lưu `around` làm tham số trang: refetch (vd khi kết nối lại) tải lại đúng cửa
        // sổ đang xem, không nhảy về tin mới nhất.
        queryClient.setQueryData<MessagesCache>(["messages", id], {
          pages: [around],
          pageParams: [{ around: messageId }],
        });
        // Cập nhật ngay cho handler socket, không đợi render.
        newerWindowRef.current = around.hasNewer;
      } catch {
        setSuppressNewer(false);
        toast.info("Không tìm thấy tin nhắn trong đoạn chat");
        return;
      }
      // Chờ cuộn mượt tới tin đích xong mới cho tải tiếp.
      window.setTimeout(() => setSuppressNewer(false), 1200);
    }
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));
    const el = document.getElementById(`message-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(messageId);
    window.setTimeout(() => {
      setHighlightedId((current) => (current === messageId ? null : current));
    }, 1500);
  };

  const markReadIfNeeded = (messageId: string) => {
    if (lastMarkedReadId.current === messageId) return;
    lastMarkedReadId.current = messageId;
    // Danh sách hội thoại tự suy "chưa đọc" từ lastReadMessageId — không có socket nào
    // báo cho List Pane khi chính mình đọc, nên phải làm mới ngay sau khi đánh dấu.
    markRead(id, messageId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["conversations", "list"] }))
      .catch(() => {
        lastMarkedReadId.current = null;
      });
  };

  // Ở cửa sổ tin cũ, messages[0] là tin mới nhất của CỬA SỔ chứ không phải của đoạn
  // chat — đánh dấu đã đọc theo nó sẽ lùi con trỏ đã đọc của người dùng.
  useEffect(() => {
    if (messages.length > 0 && !hasNewerWindow) markReadIfNeeded(messages[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages[0]?.id, hasNewerWindow]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("conversation:join", { conversationId: id });

    const onNew = (message: Message) => {
      if (message.conversationId !== id) return;
      // Tin mới nhất đổi nên người đã xem tin neo cũng đổi — luôn làm mới detail,
      // kể cả khi đang ở cửa sổ tin cũ (không chèn tin nhưng vẫn cần seenBy đúng).
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail", id] });
      // Đang ở cửa sổ tin cũ: chèn vào đầu cache sẽ đặt tin sai chỗ (sau khoảng trống).
      // Bỏ qua — tin này sẽ tới khi cuộn xuống tải trang mới hơn hoặc bấm "Đến tin mới nhất".
      if (!newerWindowRef.current) {
        queryClient.setQueryData<MessagesCache>(["messages", id], (old) => prependMessage(old, message));
        if (message.sender.id !== myId) markReadIfNeeded(message.id);
      }
    };
    const onRecalled = ({ messageId }: { messageId: string; conversationId: string }) => {
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) => applyRecall(old, messageId));
    };
    const onReaction = ({
      messageId,
      userId,
      reactionType,
    }: {
      messageId: string;
      userId: string;
      reactionType: ReactionType | null;
    }) => {
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) =>
        patchMessage(old, messageId, (m) => ({
          ...m,
          reactions: reactionType
            ? [...m.reactions.filter((r) => r.userId !== userId), { userId, reactionType }]
            : m.reactions.filter((r) => r.userId !== userId),
        })),
      );
    };
    // seenBy được backend tính theo tin neo, không suy được từ payload read — làm mới detail.
    const onRead = () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail", id] });
    };
    const onPresence = ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      queryClient.setQueryData<ConversationDetail>(["conversations", "detail", id], (old) => {
        if (!old || !old.members.some((m) => m.id === userId)) return old;
        return { ...old, members: old.members.map((m) => (m.id === userId ? { ...m, isOnline } : m)) };
      });
    };
    const timeouts = typingTimeouts.current;
    const onTyping = ({ conversationId: cid, userId }: { conversationId: string; userId: string }) => {
      if (cid !== id || userId === myId) return;
      const existing = timeouts.get(userId);
      if (existing) clearTimeout(existing);
      timeouts.set(
        userId,
        setTimeout(() => {
          timeouts.delete(userId);
          setTypingUserIds((ids) => ids.filter((i) => i !== userId));
        }, TYPING_EXPIRE_MS),
      );
      setTypingUserIds((ids) => (ids.includes(userId) ? ids : [...ids, userId]));
    };
    const onStopTyping = ({ conversationId: cid, userId }: { conversationId: string; userId: string }) => {
      if (cid !== id) return;
      const existing = timeouts.get(userId);
      if (existing) {
        clearTimeout(existing);
        timeouts.delete(userId);
      }
      setTypingUserIds((ids) => ids.filter((i) => i !== userId));
    };
    const onGroupUpdated = ({ conversationId: cid }: { conversationId: string }) => {
      if (cid !== id) return;
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail", id] });
    };
    const onMemberRemoved = ({
      conversationId: cid,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      if (cid !== id) return;
      // Message trung lập vì event này bắn cho cả người tự rời (không riêng bị
      // admin xóa) — không phân biệt được 2 trường hợp từ payload.
      if (userId === myId) {
        toast.info("Bạn không còn trong nhóm này");
        navigate("/chat");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail", id] });
    };

    socket.on("message:new", onNew);
    socket.on("message:recalled", onRecalled);
    socket.on("message:reaction", onReaction);
    socket.on("message:read", onRead);
    socket.on("presence:update", onPresence);
    socket.on("message:typing", onTyping);
    socket.on("message:stopTyping", onStopTyping);
    socket.on("group:updated", onGroupUpdated);
    socket.on("group:memberAdded", onGroupUpdated);
    socket.on("group:memberRemoved", onMemberRemoved);
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:recalled", onRecalled);
      socket.off("message:reaction", onReaction);
      socket.off("message:read", onRead);
      socket.off("presence:update", onPresence);
      socket.off("message:typing", onTyping);
      socket.off("message:stopTyping", onStopTyping);
      socket.off("group:updated", onGroupUpdated);
      socket.off("group:memberAdded", onGroupUpdated);
      socket.off("group:memberRemoved", onMemberRemoved);
      // Báo ngừng gõ NGAY lúc rời màn (không đợi hết 5s dự phòng) để đối
      // phương không bị kẹt thấy "đang nhập" dù mình đã rời màn.
      socket.emit("message:stopTyping", { conversationId: id });
      for (const t of timeouts.values()) clearTimeout(t);
      timeouts.clear();
      setTypingUserIds([]);
    };
    // Không emit conversation:leave lúc unmount — socket dùng chung toàn app,
    // rời room sẽ làm List Pane mất luôn update real-time của chính room này.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id, queryClient, myId]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      await returnToLatest();
      return sendTextMessage(id, content, replyTarget?.id);
    },
    onSuccess: () => setReplyTarget(null),
    // Không tự chèn vào cache — message:new sẽ tự đến qua socket (server
    // broadcast cho mọi member trong room, kể cả chính người gửi).
    onError: (err) => {
      if (errorCode(err) === "DIRECT_BLOCKED") {
        // Vừa bị chặn mà UI chưa kịp cập nhật — tải lại để khoá ô nhập.
        toast.info(DIRECT_BLOCKED_MESSAGE);
        queryClient.invalidateQueries({ queryKey: ["conversations", "detail", id] });
        return;
      }
      toast.error("Gửi tin nhắn thất bại, vui lòng thử lại");
    },
  });

  // Xóa reply target NGAY lúc đính kèm (không đợi upload xong) — upload chạy
  // trong store toàn cục, sống độc lập với component này, nên không có móc
  // nối "onSuccess" nào ở đây để tự xóa đúng lúc như sendMutation phía trên.
  const handleAttach = (file: File) => {
    const replyToId = replyTarget?.id;
    setReplyTarget(null);
    void returnToLatest();
    useUploadStore.getState().startUpload(id, file, replyToId);
  };

  // Kéo-thả PHẢI preventDefault() trên dragover (không chỉ drop) ở cấp
  // window — thiếu bước này, thả file ra ngoài đúng vùng chat sẽ bị trình
  // duyệt tự mở file đó thành trang mới, mất hẳn nội dung app đang xem.
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setDragOver(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setDragOver(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleAttach(file);
  };

  const recallMutation = useMutation({ mutationFn: (messageId: string) => recallMessage(messageId) });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => deleteMessageForMe(messageId),
    onSuccess: (_res, messageId) => {
      // "Xóa cho mình" KHÔNG bắn socket event -> phải tự xóa khỏi cache local.
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) =>
        removeMessageFromCache(old, messageId),
      );
      // Xoá tin neo của chính mình làm đổi tin neo của seenBy — không có socket nên phải tự làm mới.
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail", id] });
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({ messageId, reactionType }: { messageId: string; reactionType: ReactionType }) =>
      setReaction(messageId, reactionType),
  });
  const removeReactionMutation = useMutation({
    mutationFn: (messageId: string) => removeReaction(messageId),
  });

  const isDirect = detailQuery.data?.type === "DIRECT";
  const activeCallId = useCallStore((s) => s.active?.callId);
  const callInfo = detailQuery.data?.activeCall;
  // Đang ở trong chính cuộc gọi này thì không cần banner "Tham gia" nữa.
  const otherMember = isDirect ? detailQuery.data?.members.find((m) => m.id !== myId) : undefined;
  const canMessage = detailQuery.data?.canMessage ?? true;
  const ongoingCall =
    canMessage && callInfo?.status === "ONGOING" && callInfo.id !== activeCallId ? callInfo : null;
  const title = detailQuery.data?.name ?? "...";
  const headerSubtitle = isDirect && otherMember?.isOnline ? "Đang hoạt động" : undefined;

  const typingNames = typingUserIds.map(
    (uid) => detailQuery.data?.members.find((m) => m.id === uid)?.displayName ?? "Ai đó",
  );

  // Danh sách ảnh/video cho MediaViewer điều hướng Trước/Sau bằng phím mũi
  // tên — chỉ trong phạm vi tin ĐÃ TẢI (không tự fetch thêm khi chạm biên),
  // giữ nguyên thứ tự mới nhất trước của `messages`.
  const mediaItems = messages
    .filter((m) => (m.type === "IMAGE" || m.type === "VIDEO") && !m.isRecalled && m.mediaUrl)
    .map((m) => ({ id: m.id, url: m.mediaUrl!, type: m.type as "IMAGE" | "VIDEO" }));

  // Hàng avatar hiện dưới tin neo. Tin neo có thể không nằm trong cửa sổ đã tải
  // (đang xem tin cũ) — khi đó không hiện, về tin mới nhất sẽ hiện lại.
  const seenBy = detailQuery.data?.seenBy;

  return (
    <div
      className="relative flex h-full flex-col bg-background"
      onDragEnter={canMessage ? handleDragEnter : undefined}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={canMessage ? handleDragLeave : undefined}
      onDrop={canMessage ? handleDrop : undefined}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-4 border-dashed border-primary bg-primary/10">
          <p className="rounded-xl bg-background px-4 py-2 font-medium text-foreground shadow">
            Thả file để gửi
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <HeaderIdentity
          clickable={isDirect && !!otherMember}
          onClick={() => {
            if (otherMember) navigate(`/u/${otherMember.id}`, { state: { background: rootBackground(location) } });
          }}
        >
          <UserAvatar name={title} src={detailQuery.data?.avatarUrl} online={isDirect && otherMember?.isOnline} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{title}</p>
            {headerSubtitle && <p className="truncate text-xs text-muted-foreground">{headerSubtitle}</p>}
          </div>
        </HeaderIdentity>
        {detailQuery.data && (
          <div className="flex items-center gap-1">
            {canMessage && (
              <>
                <Button variant="ghost" size="icon" aria-label="Gọi thoại" onClick={() => void beginCall(id, "AUDIO")}>
                  <Phone className="size-5" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Gọi video" onClick={() => void beginCall(id, "VIDEO")}>
                  <Video className="size-5" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" aria-label="Thông tin hội thoại" onClick={() => setInfoOpen(true)}>
              <Info className="size-5" />
            </Button>
          </div>
        )}
      </div>

      {otherMember && canMessage && <FriendshipBar userId={otherMember.id} name={title} />}

      {ongoingCall && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-success/10 px-4 py-2 text-sm">
          <span className="text-foreground">Cuộc gọi đang diễn ra</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void joinExistingCall(ongoingCall.id, id, ongoingCall.type)}
          >
            Tham gia
          </Button>
        </div>
      )}

      <ConversationInfoSheet
        conversationId={id}
        open={infoOpen}
        onOpenChange={setInfoOpen}
        onJumpToMessage={(messageId) => void handleJumpToMessage(messageId)}
      />

      <div className="relative flex-1 overflow-hidden">
        {detailQuery.data?.backgroundUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${detailQuery.data.backgroundUrl})` }}
          />
        )}

        {messagesQuery.isError ? (
          <ErrorState onRetry={() => messagesQuery.refetch()} />
        ) : !messagesQuery.isLoading && messages.length === 0 ? (
          <EmptyState icon={<MessageCircle className="size-10" />} title="Hãy bắt đầu trò chuyện" />
        ) : (
          <div ref={listRef} className="relative flex h-full flex-col-reverse overflow-y-auto px-3 py-2">
            {/* Phần tử đầu DOM nằm DƯỚI CÙNG (flex-col-reverse) — sticky để nút luôn
                ghim ở đáy khung dù đang xem giữa cửa sổ tin cũ. */}
            {hasNewerWindow && (
              <div className="pointer-events-none sticky bottom-2 z-10 flex justify-center py-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="pointer-events-auto shadow-md"
                  onClick={() => void returnToLatest()}
                >
                  Đến tin mới nhất
                </Button>
              </div>
            )}
            {/* Đáy danh sách: cuộn tới đây khi đang ở cửa sổ tin cũ thì tải trang tin mới hơn. */}
            <InfiniteScrollSentinel
              enabled={
                !suppressNewer && !!messagesQuery.hasPreviousPage && !messagesQuery.isFetchingPreviousPage
              }
              onVisible={loadNewerMessages}
            />
            {messages.map((item, index) => {
              const isOwn = item.sender.id === myId;
              // messages mới nhất trước (index 0) — nhờ flex-col-reverse nên
              // index 0 hiện ở DƯỚI CÙNG (giống inverted list bên mobile): tin
              // ở index-1 mới hơn (hiện dưới tin này), index+1 cũ hơn (hiện
              // trên tin này). Avatar hiện ở tin CUỐI 1 chuỗi (dưới cùng), tên
              // người gửi (chỉ GROUP) hiện ở tin ĐẦU chuỗi (trên cùng).
              const nextMessage = messages[index - 1];
              const prevMessage = messages[index + 1];
              // Tin SYSTEM không thuộc chuỗi tin nhắn của ai — luôn coi là
              // "ngắt cụm" để không làm sai lệch avatar/tên của tin THẬT nằm
              // cạnh nó (vd trùng senderId với actor của chính tin SYSTEM đó).
              const showAvatar =
                !nextMessage || nextMessage.type === "SYSTEM" || nextMessage.sender.id !== item.sender.id;
              const showSenderName =
                !isDirect &&
                (!prevMessage || prevMessage.type === "SYSTEM" || prevMessage.sender.id !== item.sender.id);
              const myReaction = item.reactions.find((r) => r.userId === myId)?.reactionType;

              // Trong flex-col-reverse, phần tử đặt TRƯỚC trong DOM nằm DƯỚI — nên
              // hàng avatar phải đứng trước bubble để hiện dưới tin neo.
              return (
                <Fragment key={item.id}>
                  {seenBy && seenBy.messageId === item.id && seenBy.count > 0 && <SeenByRow seenBy={seenBy} />}
                  <MessageBubble
                    message={item}
                    isOwn={isOwn}
                    showAvatar={showAvatar}
                    showSenderName={showSenderName}
                    isHighlighted={highlightedId === item.id}
                    members={detailQuery.data?.members ?? []}
                    myReaction={myReaction}
                    onReply={() => setReplyTarget(item)}
                    onReact={(type) => reactMutation.mutate({ messageId: item.id, reactionType: type })}
                    onRemoveReaction={() => removeReactionMutation.mutate(item.id)}
                    onRecall={async () => {
                      const ok = await confirm({
                        title: "Thu hồi tin nhắn?",
                        destructive: true,
                        confirmLabel: "Thu hồi",
                      });
                      if (ok) recallMutation.mutate(item.id);
                    }}
                    onDelete={() => deleteMutation.mutate(item.id)}
                    onOpenMedia={() => setViewerMessageId(item.id)}
                    onDownloadFile={() => downloadFile(item.mediaUrl!, item.mediaName ?? undefined)}
                    onJumpToMessage={handleJumpToMessage}
                    canCallBack={canMessage}
                  />
                </Fragment>
              );
            })}
            <InfiniteScrollSentinel
              enabled={!!messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage}
              onVisible={() => messagesQuery.fetchNextPage()}
            />
          </div>
        )}
      </div>

      {upload && (
        <div className="border-t border-border bg-secondary px-4 py-2">
          <p className="truncate text-sm text-muted-foreground">
            Đang gửi {upload.label}... {upload.progress}%
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary" style={{ width: `${upload.progress}%` }} />
          </div>
        </div>
      )}

      {replyTarget && (
        <div className="flex items-center justify-between border-t border-border bg-secondary px-4 py-2">
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            Trả lời: {replyPreviewLabel(replyTarget)}
          </p>
          <Button variant="ghost" size="icon-sm" aria-label="Hủy trả lời" onClick={() => setReplyTarget(null)}>
            <X />
          </Button>
        </div>
      )}

      {typingNames.length > 0 && (
        <div className="border-t border-border bg-background px-4 py-1.5">
          <p className="text-xs text-muted-foreground">{typingLabel(!!isDirect, typingNames)}</p>
        </div>
      )}

      {!canMessage && otherMember ? (
        <BlockedNotice userId={otherMember.id} />
      ) : (
        <ChatInput
          onSend={(text) => sendMutation.mutate(text)}
          onAttach={handleAttach}
          onTypingChange={(isTyping) => {
            socket?.emit(isTyping ? "message:typing" : "message:stopTyping", { conversationId: id });
          }}
        />
      )}

      {viewerMessageId && (
        <MediaViewer
          items={mediaItems}
          currentId={viewerMessageId}
          onClose={() => setViewerMessageId(null)}
          onNavigate={setViewerMessageId}
        />
      )}
    </div>
  );
}
