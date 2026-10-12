import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { InfiniteData } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";

import {
  ActionSheet,
  Avatar,
  ChatInput,
  EmptyState,
  ErrorState,
  Header,
  MessageBubble,
  confirm,
  useToast,
} from "@/components/ui";
import type { ActionSheetItem } from "@/components/ui/action-sheet";
import { BlockedNotice } from "@/components/chat/blocked-notice";
import { FriendshipBar } from "@/components/chat/friendship-bar";
import { SeenByRow } from "@/components/chat/seen-by-row";
import { ApiError, errorCodeOf } from "@/lib/api-client";
import {
  DIRECT_BLOCKED_MESSAGE,
  getConversationDetail,
  previewInviteLink,
  type ConversationDetail,
} from "@/lib/conversations";
import {
  deleteMessageForMe,
  getMessagesAround,
  listMessages,
  listMessagesAfter,
  markRead,
  recallMessage,
  removeReaction,
  sendMediaMessage,
  sendTextMessage,
  setReaction,
  type Message,
  type MessagesPage,
  type ReactionType,
} from "@/lib/messages";
import { beginCall, joinExistingCall } from "@/lib/call-actions";
import { isCallingSupported } from "@/lib/calling-support";
import { parseInviteToken } from "@/lib/invite-link";
import { downloadAndShare, uploadMedia } from "@/lib/media";
import { replyPreviewLabel } from "@/lib/reply-preview";
import { systemMessageText } from "@/lib/system-message";
import { useCallStore } from "@/store/call-store";
import { useJumpStore } from "@/store/jump-store";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";

const REACTIONS: ReactionType[] = [
  "like",
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
];
const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😠",
};
const TYPING_EXPIRE_MS = 5000;

const styles = StyleSheet.create({
  // Tô sáng ngắn tin vừa nhảy tới (màu primary nhạt, đọc được ở cả 2 theme).
  highlighted: {
    backgroundColor: "rgba(13, 148, 136, 0.18)",
    borderRadius: 12,
  },
});

// `cursor` = trang tin cũ hơn, `after` = trang tin mới hơn, `around` = cửa sổ
// quanh 1 tin (nhảy tới tin).
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

// Thu hồi 1 tin phải cập nhật CẢ BẢN THÂN tin đó LẪN bất kỳ tin nào khác đang
// "trả lời" nó — replyTo là 1 bản snapshot riêng được nhúng vào từng tin lúc
// fetch, không tự động đồng bộ khi tin gốc đổi trạng thái sau đó.
function applyRecall(
  data: MessagesCache | undefined,
  messageId: string,
): MessagesCache | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            isRecalled: true,
            content: null,
            mediaUrl: null,
            mediaPublicId: null,
            mediaName: null,
            mediaSize: null,
            reactions: [],
          };
        }
        if (m.replyTo?.id === messageId) {
          return {
            ...m,
            replyTo: {
              ...m.replyTo,
              content: null,
              mediaUrl: null,
              mediaName: null,
              isRecalled: true,
            },
          };
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

// Nhóm tối đa 2 tên rồi gộp phần còn lại thành "và N người khác" — đủ dùng cho
// MVP, không cần liệt kê hết khi nhóm đông người đang gõ cùng lúc.
function typingLabel(isDirect: boolean, names: string[]): string {
  if (isDirect) return "Đang nhập...";
  if (names.length === 1) return `${names[0]} đang nhập...`;
  if (names.length === 2) return `${names[0]}, ${names[1]} đang nhập...`;
  return `${names[0]} và ${names.length - 1} người khác đang nhập...`;
}

function prependMessage(
  data: MessagesCache | undefined,
  message: Message,
): MessagesCache | undefined {
  if (!data || data.pages.length === 0) {
    return {
      pages: [{ items: [message], nextCursor: null }],
      pageParams: [{}],
    };
  }
  // Chặn trùng id — có thể nhận cùng 1 message:new nhiều lần nếu màn này lỡ
  // mount 2 lần cho cùng 1 conversationId (mỗi instance tự đăng ký socket
  // listener riêng), không có bước này sẽ chèn trùng, FlatList bị lỗi key
  // trùng (đã xảy ra thật).
  if (data.pages.some((p) => p.items.some((m) => m.id === message.id))) {
    return data;
  }
  const pages = [...data.pages];
  pages[0] = { ...pages[0], items: [message, ...pages[0].items] };
  return { ...data, pages };
}

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const toast = useToast();
  const myId = useAuthStore((s) => s.user?.id);
  const colorScheme = useColorScheme();
  const activeCallId = useCallStore((s) => s.active?.callId);

  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [menuTarget, setMenuTarget] = useState<Message | null>(null);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [uploadState, setUploadState] = useState<{
    label: string;
    progress: number;
  } | null>(null);
  const lastMarkedReadId = useRef<string | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  // Dự phòng khi message:stopTyping bị mất (vd app đối phương crash giữa lúc
  // gõ) — tự hết "đang nhập" sau 1 khoảng thời gian không nhận thêm sự kiện.
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", id],
    queryFn: () => getConversationDetail(id),
  });

  // Mở 1 hội thoại không còn là thành viên (bị xoá/đã rời/nhóm giải tán ở
  // thiết bị khác) trả 404 — không xử lý sẽ kẹt ở màn trống tiêu đề "...".
  // Message trung lập vì 404 không phân biệt được các trường hợp này.
  useEffect(() => {
    if (
      detailQuery.error instanceof ApiError &&
      detailQuery.error.status === 404
    ) {
      toast.show("Hội thoại này không còn khả dụng");
      router.replace("/");
    }
  }, [detailQuery.error, router, toast]);

  // Phân trang 2 chiều: trang sau (`fetchNextPage`, cuộn lên) là tin CŨ hơn,
  // trang trước (`fetchPreviousPage`, cuộn xuống) là tin MỚI hơn — chỉ có khi
  // đang ở cửa sổ tin cũ sau khi nhảy tới 1 tin.
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
      firstPage.hasNewer && firstPage.items[0]
        ? { after: firstPage.items[0].id }
        : undefined,
    // Lúc không mở màn này, socket vẫn có thể bỏ lỡ tin mới — cache cũ khiến
    // "đánh dấu đã đọc" gửi id tin cũ. Luôn lấy mới khi mở lại.
    staleTime: 0,
  });

  const messages = messagesQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const markReadIfNeeded = (messageId: string) => {
    if (lastMarkedReadId.current === messageId) return;
    lastMarkedReadId.current = messageId;
    // Tab Tin nhắn suy "chưa đọc" từ lastReadMessageId — không có socket nào
    // báo khi chính mình đọc, nên phải tự làm mới để chấm xanh biến mất.
    markRead(id, messageId)
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: ["conversations", "list"],
        }),
      )
      .catch(() => {
        lastMarkedReadId.current = null;
      });
  };

  // Cửa sổ "tin cũ" sau khi nhảy tới 1 tin ngoài phần đã tải: cache chưa có
  // tới tin mới nhất. Suy thẳng từ trang đầu (mới nhất) đang có — cuộn xuống
  // tải hết phần tin mới hơn thì tự hết, không cần state riêng.
  const hasNewerWindow = !!messagesQuery.data?.pages[0]?.hasNewer;
  // Handler socket đăng ký 1 lần nên phải đọc giá trị mới nhất qua ref.
  const newerWindowRef = useRef(false);
  useEffect(() => {
    newerWindowRef.current = hasNewerWindow;
  }, [hasNewerWindow]);

  // Rời màn khi đang ở cửa sổ tin cũ: bỏ cache để lần mở sau bắt đầu từ tin
  // mới nhất — cửa sổ được lưu làm tham số trang (để refetch lúc ĐANG xem giữ
  // đúng chỗ) nên nếu giữ cache, mở lại sẽ tải lại đúng cửa sổ tin cũ đó.
  useEffect(
    () => () => {
      if (newerWindowRef.current) {
        queryClient.removeQueries({ queryKey: ["messages", id], exact: true });
      }
    },
    [id, queryClient],
  );

  const listRef = useRef<FlatList<Message>>(null);

  // Gửi tin/đính kèm khi đang xem tin cũ: về tin mới nhất trước, nếu không
  // tin vừa gửi (tới qua socket) bị bỏ qua và người dùng không thấy đâu.
  const returnToLatest = async () => {
    if (!newerWindowRef.current) return;
    newerWindowRef.current = false;
    await queryClient.resetQueries({ queryKey: ["messages", id] });
    // FlatList giữ nguyên vị trí cuộn cũ (đang ở sâu trong lịch sử) dù data
    // đã thay — phải tự về cuối (offset 0 vì danh sách inverted).
    setTimeout(
      () => listRef.current?.scrollToOffset({ offset: 0, animated: false }),
      50,
    );
  };

  // Ở cửa sổ tin cũ, messages[0] là tin mới nhất của CỬA SỔ chứ không phải
  // của đoạn chat — đánh dấu theo nó sẽ lùi con trỏ đã đọc.
  useEffect(() => {
    if (messages.length > 0 && !hasNewerWindow) {
      markReadIfNeeded(messages[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages[0]?.id, hasNewerWindow]);

  const scrollRetries = useRef(0);
  const suppressStartReached = useRef(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // FlatList chưa kịp nhận data mới (vừa thay cache) thì scrollToIndex ném lỗi
  // "out of range" — thử lại vài nhịp thay vì để crash.
  const scrollToIndexSafely = (index: number, attempt = 0) => {
    try {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    } catch {
      if (attempt < 5) {
        setTimeout(() => scrollToIndexSafely(index, attempt + 1), 100);
      }
    }
  };

  // Cuộn tới 1 tin + tô sáng ngắn. Tin chưa tải (kết quả tìm kiếm, tin gốc
  // của trích dẫn ở trang cũ) thì lấy cả cửa sổ quanh nó trong 1 request và
  // thay cache bằng cửa sổ đó.
  const jumpToMessage = async (messageId: string) => {
    let index = messages.findIndex((m) => m.id === messageId);
    if (index < 0) {
      // Cửa sổ mới nạp xong thì danh sách còn đứng ở đáy (offset 0) — đúng
      // vùng kích hoạt onStartReached, sẽ tự tải dồn hết tin mới hơn trước khi
      // kịp cuộn tới tin đích. Khoá lại tới khi cuộn xong.
      suppressStartReached.current = true;
      try {
        const around = await getMessagesAround(id, messageId);
        // Lưu `around` làm tham số trang: refetch (vd khi kết nối lại) tải lại
        // đúng cửa sổ đang xem, không nhảy về tin mới nhất.
        queryClient.setQueryData<MessagesCache>(["messages", id], {
          pages: [around],
          pageParams: [{ around: messageId }],
        });
        // Cập nhật ngay cho handler socket, không đợi render.
        newerWindowRef.current = around.hasNewer;
        index = around.items.findIndex((m) => m.id === messageId);
      } catch {
        suppressStartReached.current = false;
        toast.show("Không tìm thấy tin nhắn trong đoạn chat");
        return;
      }
    }
    scrollRetries.current = 0;
    setTimeout(() => scrollToIndexSafely(index), 100);
    // Đủ cho cả các lần thử lại của scrollToIndex (onScrollToIndexFailed).
    setTimeout(() => {
      suppressStartReached.current = false;
    }, 1500);
    setHighlightedId(messageId);
    setTimeout(() => {
      setHighlightedId((current) => (current === messageId ? null : current));
    }, 1800);
  };

  // Màn tìm kiếm (chồng lên trên) gửi yêu cầu qua store rồi dismissTo về đây.
  // Nghe qua subscribe (callback) — màn này luôn mounted sẵn phía dưới stack
  // lúc yêu cầu được gửi; đọc hàm mới nhất qua ref vì nó đóng kín `messages`.
  const jumpToMessageRef = useRef(jumpToMessage);
  useEffect(() => {
    jumpToMessageRef.current = jumpToMessage;
  });
  useEffect(
    () =>
      useJumpStore.subscribe(({ pending }) => {
        if (!pending || pending.conversationId !== id) return;
        useJumpStore.getState().clear();
        void jumpToMessageRef.current(pending.messageId);
      }),
    [id],
  );

  useEffect(() => {
    if (!socket) return;
    socket.emit("conversation:join", { conversationId: id });
    const timeouts = typingTimeouts.current;

    // seenBy do backend tính theo tin neo (tin mới nhất) — tin mới đổi tin neo,
    // ai đã đọc đổi thì đổi danh sách người xem: cả 2 đều phải tải lại chi tiết.
    const refreshDetail = () =>
      queryClient.invalidateQueries({
        queryKey: ["conversations", "detail", id],
      });

    const onNew = (message: Message) => {
      if (message.conversationId !== id) return;
      // Detail luôn làm mới (seenBy đổi theo tin neo) kể cả khi đang ở cửa sổ tin cũ.
      refreshDetail();
      // Đang ở cửa sổ tin cũ: chèn vào đầu cache sẽ đặt tin sai chỗ (sau một
      // khoảng trống chưa tải) — bỏ qua, bấm "Đến tin mới nhất" để tải lại đủ.
      if (newerWindowRef.current) return;
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) =>
        prependMessage(old, message),
      );
      if (message.sender.id !== myId) markReadIfNeeded(message.id);
    };
    const onRecalled = ({
      messageId,
    }: {
      messageId: string;
      conversationId: string;
    }) => {
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) =>
        applyRecall(old, messageId),
      );
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
            ? [
                ...m.reactions.filter((r) => r.userId !== userId),
                { userId, reactionType },
              ]
            : m.reactions.filter((r) => r.userId !== userId),
        })),
      );
    };
    const onRead = ({ conversationId }: { conversationId: string }) => {
      if (conversationId === id) refreshDetail();
    };

    const onTyping = ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      if (conversationId !== id || userId === myId) return;
      const existing = timeouts.get(userId);
      if (existing) clearTimeout(existing);
      timeouts.set(
        userId,
        setTimeout(() => {
          timeouts.delete(userId);
          setTypingUserIds((ids) => ids.filter((i) => i !== userId));
        }, TYPING_EXPIRE_MS),
      );
      setTypingUserIds((ids) =>
        ids.includes(userId) ? ids : [...ids, userId],
      );
    };
    const onStopTyping = ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      if (conversationId !== id) return;
      const existing = timeouts.get(userId);
      if (existing) {
        clearTimeout(existing);
        timeouts.delete(userId);
      }
      setTypingUserIds((ids) => ids.filter((i) => i !== userId));
    };
    const onPresence = ({
      userId,
      isOnline,
    }: {
      userId: string;
      isOnline: boolean;
    }) => {
      queryClient.setQueryData<ConversationDetail>(
        ["conversations", "detail", id],
        (old) => {
          if (!old || !old.members.some((m) => m.id === userId)) return old;
          return {
            ...old,
            members: old.members.map((m) =>
              m.id === userId ? { ...m, isOnline } : m,
            ),
          };
        },
      );
    };

    const onGroupUpdated = ({ conversationId }: { conversationId: string }) => {
      if (conversationId !== id) return;
      queryClient.invalidateQueries({
        queryKey: ["conversations", "detail", id],
      });
    };
    const onMemberRemoved = ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      if (conversationId !== id) return;
      // Message trung lập vì event này bắn cho cả người tự rời (không riêng
      // bị admin xóa) — xem ghi chú trong conversation-info/[id].tsx.
      if (userId === myId) {
        toast.show("Bạn không còn trong nhóm này");
        router.replace("/");
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["conversations", "detail", id],
      });
    };

    socket.on("message:new", onNew);
    socket.on("message:recalled", onRecalled);
    socket.on("message:reaction", onReaction);
    socket.on("message:read", onRead);
    socket.on("message:typing", onTyping);
    socket.on("message:stopTyping", onStopTyping);
    socket.on("presence:update", onPresence);
    socket.on("group:updated", onGroupUpdated);
    socket.on("group:memberAdded", onGroupUpdated);
    socket.on("group:memberRemoved", onMemberRemoved);
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:recalled", onRecalled);
      socket.off("message:reaction", onReaction);
      socket.off("message:read", onRead);
      socket.off("message:typing", onTyping);
      socket.off("message:stopTyping", onStopTyping);
      socket.off("presence:update", onPresence);
      socket.off("group:updated", onGroupUpdated);
      socket.off("group:memberAdded", onGroupUpdated);
      socket.off("group:memberRemoved", onMemberRemoved);
      // Rời màn lúc đang gõ -> báo đối phương ngừng ngay, không chờ hết 5s dự phòng.
      socket.emit("message:stopTyping", { conversationId: id });
      for (const t of timeouts.values()) clearTimeout(t);
      timeouts.clear();
      setTypingUserIds([]);
    };
    // Không emit conversation:leave khi unmount — socket dùng chung toàn app,
    // rời room sẽ làm tab Tin nhắn mất luôn update real-time của chính room này.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id, queryClient, myId]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      await returnToLatest();
      return sendTextMessage(id, content, replyTarget?.id);
    },
    onSuccess: () => setReplyTarget(null),
    // Không tự chèn vào cache ở đây — message:new sẽ tự đến qua socket (server
    // broadcast cho mọi member trong room, kể cả chính người gửi).
    onError: (err) => {
      if (handleBlockedError(err)) return;
      toast.show("Gửi tin nhắn thất bại, vui lòng thử lại");
    },
  });

  // Vừa bị chặn mà màn chưa kịp cập nhật — báo và tải lại chi tiết để khoá ô nhập.
  function handleBlockedError(err: unknown) {
    if (errorCodeOf(err) !== "DIRECT_BLOCKED") return false;
    toast.show(DIRECT_BLOCKED_MESSAGE);
    queryClient.invalidateQueries({
      queryKey: ["conversations", "detail", id],
    });
    return true;
  }

  const recallMutation = useMutation({
    mutationFn: (messageId: string) => recallMessage(messageId),
  });

  const handlePickImageVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.show("Cần quyền truy cập thư viện ảnh để gửi");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    await uploadAndSend({
      uri: asset.uri,
      // Tên chỉ để hiển thị/làm field name trong multipart form — tính duy
      // nhất thật sự do Cloudinary tự sinh UUID ở server, không cần ở đây.
      name: asset.fileName ?? (isVideo ? "video.mp4" : "image.jpg"),
      mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
      messageType: isVideo ? "VIDEO" : "IMAGE",
    });
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/zip",
      ],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadAndSend({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      messageType: "FILE",
    });
  };

  const uploadAndSend = async (file: {
    uri: string;
    name: string;
    mimeType: string;
    messageType: "IMAGE" | "VIDEO" | "FILE";
  }) => {
    void returnToLatest();
    setUploadState({ label: file.name, progress: 0 });
    try {
      const uploaded = await uploadMedia(file, "MESSAGE", (progress) =>
        setUploadState({ label: file.name, progress }),
      );
      await sendMediaMessage(
        id,
        file.messageType,
        uploaded.url,
        uploaded.publicId,
        file.messageType === "FILE"
          ? { mediaName: uploaded.originalName, mediaSize: uploaded.bytes }
          : undefined,
      );
    } catch (e) {
      if (handleBlockedError(e)) return;
      toast.show(
        e instanceof Error ? e.message : "Gửi thất bại, vui lòng thử lại",
      );
    } finally {
      setUploadState(null);
    }
  };

  const handleOpenFile = async (url: string) => {
    try {
      await downloadAndShare(url);
    } catch {
      toast.show("Mở file thất bại, vui lòng thử lại");
    }
  };

  // Link mời là của chính app -> điều hướng thẳng bằng router, không qua
  // Linking.openURL/hệ điều hành: scheme zahuu:// cần rebuild native mới được
  // đăng ký, không phải lúc nào Dev Client đang cài cũng đã có sẵn.
  const handleLinkPress = async (url: string) => {
    const token = parseInviteToken(url);
    if (token) {
      // Kiểm tra trước ngay tại đây (không điều hướng) — nếu đã là thành viên
      // thì xử lý gọn luôn, không cần qua màn /invite/[token] (tránh cảm giác
      // "chuyển màn đen rồi quay lại" dù chỉ xác nhận thứ mình đã biết).
      try {
        const preview = await previewInviteLink(token);
        if (preview.alreadyMember) {
          if (preview.conversationId === id) {
            toast.show("Bạn đang ở trong nhóm này rồi");
          } else {
            router.push(`/conversation/${preview.conversationId}`);
          }
          return;
        }
      } catch {
        // Lỗi (token sai/hết hạn...) để màn /invite/[token] tự fetch lại và
        // hiện đúng ErrorState, không lặp lại logic thông báo lỗi ở đây.
      }
      // Chưa phải thành viên -> vẫn cần màn xác nhận thật sự (preview + nút
      // Tham gia/Huỷ), kèm "from" phòng trường hợp hiếm vừa được thêm vào
      // đúng lúc đang fetch (xem ghi chú trong invite/[token].tsx).
      router.push({
        pathname: "/invite/[token]",
        params: { token, from: id },
      });
      return;
    }
    Linking.openURL(url).catch(() => toast.show("Không mở được link này"));
  };

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => deleteMessageForMe(messageId),
    onSuccess: (_res, messageId) => {
      // "Xóa cho mình" KHÔNG bắn socket event -> phải tự xóa khỏi cache local.
      queryClient.setQueryData<MessagesCache>(["messages", id], (old) =>
        removeMessageFromCache(old, messageId),
      );
      // Xoá chính tin neo làm đổi tin neo của seenBy — không có socket nên tự làm mới.
      queryClient.invalidateQueries({
        queryKey: ["conversations", "detail", id],
      });
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({
      messageId,
      reactionType,
    }: {
      messageId: string;
      reactionType: ReactionType;
    }) => setReaction(messageId, reactionType),
  });
  const removeReactionMutation = useMutation({
    mutationFn: (messageId: string) => removeReaction(messageId),
  });

  // otherMember chỉ có ở DIRECT (online, thanh kết bạn, chặn nhau) — tên/avatar
  // hiện trên header lấy thẳng name/avatarUrl đã resolve sẵn từ backend (đúng
  // cho cả DIRECT lẫn GROUP), không tự suy ra từ members để tránh lấy nhầm
  // avatar của 1 thành viên bất kỳ làm avatar nhóm.
  const isDirect = detailQuery.data?.type === "DIRECT";
  const otherMember = isDirect
    ? detailQuery.data?.members.find((m) => m.id !== myId)
    : undefined;
  const title = detailQuery.data?.name ?? "...";
  const headerSubtitle =
    isDirect && otherMember?.isOnline ? "Đang hoạt động" : undefined;
  // 2 người chặn nhau thì không gửi tin/gọi được — ẩn mọi lối vào thay vì để
  // người dùng bấm rồi mới nhận lỗi.
  const canMessage = detailQuery.data?.canMessage ?? true;
  const canCall = isCallingSupported && canMessage;

  const iconColor = colorScheme === "dark" ? "#f4f4f5" : "#18181b";
  // Banner "Tham gia" chỉ cho cuộc gọi đã có người nghe mà mình chưa ở trong đó —
  // cuộc gọi đang đổ chuông đã có overlay/banner nhận cuộc gọi riêng.
  const callInfo = detailQuery.data?.activeCall;
  const ongoingCall =
    canCall && callInfo?.status === "ONGOING" && callInfo.id !== activeCallId
      ? callInfo
      : null;

  // Hàng avatar "đã xem" hiện dưới tin neo (tin mới nhất mình còn thấy, kể cả
  // tin của người khác) — cho cả DIRECT lẫn GROUP.
  const seenBy = detailQuery.data?.seenBy;
  const listExtraData = useMemo(
    () => ({ detail: detailQuery.data, highlightedId }),
    [detailQuery.data, highlightedId],
  );

  const typingNames = typingUserIds.map(
    (uid) =>
      detailQuery.data?.members.find((m) => m.id === uid)?.displayName ??
      "Ai đó",
  );

  const myReaction = menuTarget?.reactions.find(
    (r) => r.userId === myId,
  )?.reactionType;

  const menuItems: ActionSheetItem[] = menuTarget
    ? [
        ...(!menuTarget.isRecalled
          ? [
              {
                key: "reply",
                label: "Trả lời",
                icon: "arrow-undo-outline" as const,
                onPress: () => setReplyTarget(menuTarget),
              },
              ...(menuTarget.type === "TEXT"
                ? [
                    {
                      key: "copy",
                      label: "Sao chép",
                      icon: "copy-outline" as const,
                      onPress: async () => {
                        await Clipboard.setStringAsync(
                          menuTarget.content ?? "",
                        );
                        toast.show("Đã sao chép");
                      },
                    },
                  ]
                : []),
            ]
          : []),
        ...(menuTarget.sender.id === myId && !menuTarget.isRecalled
          ? [
              {
                key: "recall",
                label: "Thu hồi",
                icon: "arrow-undo-circle-outline" as const,
                destructive: true,
                onPress: async () => {
                  const ok = await confirm({
                    title: "Thu hồi tin nhắn?",
                    destructive: true,
                    confirmLabel: "Thu hồi",
                  });
                  if (ok) recallMutation.mutate(menuTarget.id);
                },
              },
            ]
          : []),
        {
          key: "delete",
          label: "Xóa (chỉ ở máy tôi)",
          icon: "trash-outline" as const,
          destructive: true,
          onPress: () => deleteMutation.mutate(menuTarget.id),
        },
      ]
    : [];

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Header
        title={title}
        subtitle={headerSubtitle}
        onTitlePress={() => router.push(`/conversation-info/${id}`)}
        right={
          <View className="flex-row items-center gap-1">
            {canCall && (
              <>
                <Pressable
                  accessibilityLabel="Gọi thoại"
                  onPress={() => void beginCall(id, "AUDIO")}
                  className="h-10 w-10 items-center justify-center"
                >
                  <Ionicons name="call-outline" size={22} color={iconColor} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Gọi video"
                  onPress={() => void beginCall(id, "VIDEO")}
                  className="h-10 w-10 items-center justify-center"
                >
                  <Ionicons
                    name="videocam-outline"
                    size={24}
                    color={iconColor}
                  />
                </Pressable>
              </>
            )}
            <Pressable onPress={() => router.push(`/conversation-info/${id}`)}>
              <Avatar
                name={title}
                uri={detailQuery.data?.avatarUrl}
                size={32}
              />
            </Pressable>
          </View>
        }
      />

      {otherMember && canMessage && (
        <FriendshipBar userId={otherMember.id} name={title} />
      )}

      {ongoingCall && (
        <View className="flex-row items-center justify-between bg-success px-4 py-2">
          <Text className="text-sm font-medium text-white">
            Cuộc gọi đang diễn ra
          </Text>
          <Pressable
            onPress={() =>
              void joinExistingCall(ongoingCall.id, id, ongoingCall.type)
            }
            className="rounded-full bg-white/20 px-3 py-1 active:opacity-70"
          >
            <Text className="text-sm font-semibold text-white">Tham gia</Text>
          </Pressable>
        </View>
      )}

      <View className="flex-1">
        {detailQuery.data?.backgroundUrl && (
          <Image
            source={{ uri: detailQuery.data.backgroundUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        )}
        {messagesQuery.isError ? (
          <ErrorState onRetry={() => messagesQuery.refetch()} />
        ) : !messagesQuery.isLoading && messages.length === 0 ? (
          <EmptyState
            title="Hãy bắt đầu trò chuyện"
            icon="chatbubble-outline"
          />
        ) : (
          <FlatList
            ref={listRef}
            className="flex-1"
            data={messages}
            // Dòng tin còn phụ thuộc chi tiết hội thoại (seenBy, tên thành
            // viên cho tin SYSTEM, canMessage) và tin đang tô sáng — đổi thì
            // phải vẽ lại dù danh sách tin nhắn không đổi.
            extraData={listExtraData}
            inverted
            keyExtractor={(item) => item.id}
            onEndReached={() => {
              if (
                messagesQuery.hasNextPage &&
                !messagesQuery.isFetchingNextPage
              ) {
                messagesQuery.fetchNextPage();
              }
            }}
            // List inverted nên "start" là phía dưới (tin mới) — chỉ có trang
            // trước khi đang ở cửa sổ tin cũ sau khi nhảy tới 1 tin.
            onStartReached={() => {
              if (
                !suppressStartReached.current &&
                messagesQuery.hasPreviousPage &&
                !messagesQuery.isFetchingPreviousPage
              ) {
                messagesQuery.fetchPreviousPage();
              }
            }}
            // Nửa màn hình (mặc định 2) — tin đích nằm giữa cửa sổ ~60 tin, với
            // ngưỡng lớn nó vẫn lọt vùng kích hoạt và tự tải tin mới hơn dù
            // người dùng chưa kéo xuống.
            onStartReachedThreshold={0.5}
            // Chèn trang tin mới hơn vào đầu danh sách (phía dưới) sẽ đẩy nội
            // dung đang xem đi — giữ tin đang hiện đứng yên. Chỉ bật ở cửa sổ
            // tin cũ: ở chế độ thường, tin mới tới phải hiện ra ngay ở cuối.
            maintainVisibleContentPosition={
              hasNewerWindow ? { minIndexForVisible: 0 } : undefined
            }
            // Tin đích chưa được đo (nằm ngoài vùng đã render) — cuộn ước
            // lượng tới gần để nó được render, rồi thử lại.
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: false,
              });
              if (scrollRetries.current++ < 5) {
                setTimeout(() => scrollToIndexSafely(info.index), 150);
              }
            }}
            contentContainerClassName="px-3 py-2"
            renderItem={({ item, index }) => {
              const isOwn = item.sender.id === myId;
              const showSeenBy =
                !!seenBy && seenBy.messageId === item.id && seenBy.count > 0;
              // messages mới nhất trước (index 0 = mới nhất = hiện dưới cùng do
              // inverted) -> tin ở index-1 là tin GẦN ĐÂY HƠN (hiện dưới tin này),
              // tin ở index+1 là tin CŨ HƠN (hiện phía TRÊN tin này).
              // Avatar hiện ở tin CUỐI 1 chuỗi liên tiếp (dưới cùng), tên người gửi
              // (chỉ GROUP) hiện ở tin ĐẦU chuỗi (trên cùng) — giống Messenger.
              const nextMessage = messages[index - 1];
              const prevMessage = messages[index + 1];
              // Tin SYSTEM xen giữa cắt chuỗi, kể cả khi người thực hiện hành
              // động chính là người gửi tin liền kề.
              const showAvatar =
                !nextMessage ||
                nextMessage.type === "SYSTEM" ||
                nextMessage.sender.id !== item.sender.id;
              const showSenderName =
                !isDirect &&
                (!prevMessage ||
                  prevMessage.type === "SYSTEM" ||
                  prevMessage.sender.id !== item.sender.id);
              // Tin SYSTEM/CALL không thu hồi/react/trả lời được nên không mở menu.
              const isInteractive =
                item.type !== "SYSTEM" && item.type !== "CALL";
              return (
                <View
                  // style thay vì đổi className: chỉ tô nền tạm thời, không
                  // cần NativeWind tính lại class.
                  style={
                    highlightedId === item.id ? styles.highlighted : undefined
                  }
                >
                  <MessageBubble
                    isOwn={isOwn}
                    senderName={item.sender.displayName}
                    senderAvatarUrl={item.sender.avatarUrl}
                    showAvatar={showAvatar}
                    showSenderName={showSenderName}
                    systemText={
                      item.type === "SYSTEM" && item.content
                        ? systemMessageText(
                            item.content,
                            item.sender,
                            detailQuery.data?.members ?? [],
                          )
                        : undefined
                    }
                    onLongPress={
                      isInteractive ? () => setMenuTarget(item) : undefined
                    }
                    onCallBack={
                      canCall && item.call
                        ? () => void beginCall(id, item.call!.type)
                        : undefined
                    }
                    onLinkPress={handleLinkPress}
                    onReplyPress={
                      item.replyTo
                        ? () => void jumpToMessage(item.replyTo!.id)
                        : undefined
                    }
                    onPress={
                      item.mediaUrl
                        ? item.type === "IMAGE" || item.type === "VIDEO"
                          ? () =>
                              router.push({
                                pathname: "/media-viewer",
                                params: {
                                  url: item.mediaUrl!,
                                  type: item.type,
                                },
                              })
                          : item.type === "FILE"
                            ? () => handleOpenFile(item.mediaUrl!)
                            : undefined
                        : undefined
                    }
                    message={{
                      id: item.id,
                      type: item.type,
                      content: item.content,
                      mediaUrl: item.mediaUrl,
                      mediaName: item.mediaName,
                      mediaSize: item.mediaSize,
                      call: item.call,
                      isRecalled: item.isRecalled,
                      replyTo: item.replyTo,
                      reactionEmojis: Array.from(
                        new Set(item.reactions.map((r) => r.reactionType)),
                      ),
                    }}
                  />
                  {showSeenBy && <SeenByRow seenBy={seenBy} />}
                </View>
              );
            }}
          />
        )}
        {hasNewerWindow && (
          <View className="absolute bottom-3 left-0 right-0 items-center">
            <Pressable
              onPress={() => void returnToLatest()}
              className="flex-row items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 active:opacity-80 dark:bg-zinc-100"
            >
              <Ionicons
                name="arrow-down"
                size={16}
                color={colorScheme === "dark" ? "#18181b" : "#fff"}
              />
              <Text className="text-sm font-medium text-white dark:text-zinc-900">
                Đến tin mới nhất
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {uploadState && (
        <View className="border-t border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <Text
            numberOfLines={1}
            className="text-sm text-zinc-500 dark:text-zinc-400"
          >
            Đang gửi {uploadState.label}... {uploadState.progress}%
          </Text>
          <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <View
              className="h-full rounded-full bg-primary dark:bg-primary-dark"
              style={{ width: `${uploadState.progress}%` }}
            />
          </View>
        </View>
      )}

      {replyTarget && (
        <View className="flex-row items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <Text
            numberOfLines={1}
            className="flex-1 text-sm text-zinc-500 dark:text-zinc-400"
          >
            Trả lời: {replyPreviewLabel(replyTarget)}
          </Text>
          <Pressable onPress={() => setReplyTarget(null)} className="px-2">
            <Text className="text-zinc-400">✕</Text>
          </Pressable>
        </View>
      )}

      {typingNames.length > 0 && (
        <View className="border-t border-zinc-200 bg-white px-4 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
          <Text className="text-xs text-zinc-400">
            {typingLabel(isDirect, typingNames)}
          </Text>
        </View>
      )}

      {!canMessage && otherMember ? (
        <BlockedNotice userId={otherMember.id} />
      ) : (
        <ChatInput
          onSend={(text) => sendMutation.mutate(text)}
          onAttach={() => setAttachSheetOpen(true)}
          onTypingChange={(isTyping) => {
            socket?.emit(isTyping ? "message:typing" : "message:stopTyping", {
              conversationId: id,
            });
          }}
        />
      )}

      <ActionSheet
        visible={attachSheetOpen}
        onClose={() => setAttachSheetOpen(false)}
        items={[
          {
            key: "media",
            label: "Ảnh/Video",
            icon: "image-outline",
            onPress: handlePickImageVideo,
          },
          {
            key: "file",
            label: "File",
            icon: "document-outline",
            onPress: handlePickFile,
          },
        ]}
      />

      <ActionSheet
        visible={!!menuTarget}
        onClose={() => setMenuTarget(null)}
        header={
          menuTarget && !menuTarget.isRecalled ? (
            <View className="flex-row justify-around border-b border-zinc-100 px-2 py-3 dark:border-zinc-800">
              {REACTIONS.map((r) => (
                <Pressable
                  key={r}
                  className="p-1"
                  onPress={() => {
                    if (!menuTarget) return;
                    setMenuTarget(null);
                    if (myReaction === r)
                      removeReactionMutation.mutate(menuTarget.id);
                    else
                      reactMutation.mutate({
                        messageId: menuTarget.id,
                        reactionType: r,
                      });
                  }}
                >
                  <Text className="text-2xl">{REACTION_EMOJI[r]}</Text>
                </Pressable>
              ))}
            </View>
          ) : undefined
        }
        items={menuItems}
      />
    </KeyboardAvoidingView>
  );
}
