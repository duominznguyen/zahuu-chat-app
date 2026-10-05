import { useQueryClient } from "@tanstack/react-query";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import { useEffect } from "react";
import { CallRoom, CallStatusLabel } from "@/components/call-room";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  acceptIncomingCall,
  clearCallIfMatches,
  endActiveCall,
  rejectIncomingCall,
} from "@/lib/call-actions";
import type { IncomingCallPayload } from "@/lib/calls";
import type { ConversationDetail } from "@/lib/conversations";
import { startRingtone, stopRingtone } from "@/lib/ringtone";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";
import { useCallStore } from "@/store/call-store";

// Không bắt máy / không ai nghe sau 30s thì coi như nhỡ — khớp kế hoạch calling.
const RING_TIMEOUT_MS = 30_000;
// Cuộc gọi nhóm không ép người dùng phản hồi — banner tự ẩn sau một lúc, nhưng vẫn
// có thể vào lại qua banner "Đang gọi" trong header conversation.
const GROUP_BANNER_TIMEOUT_MS = 60_000;

export function CallOverlays() {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const active = useCallStore((s) => s.active);
  const incoming = useCallStore((s) => s.incoming);

  useEffect(() => {
    if (!isAuthenticated) {
      useCallStore.getState().clearActive();
      useCallStore.getState().clearIncoming();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!socket) return;
    const refreshDetail = (conversationId: string) =>
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail", conversationId] });

    const onIncoming = (payload: IncomingCallPayload) => {
      refreshDetail(payload.conversationId);
      const store = useCallStore.getState();
      // Đang trong cuộc gọi khác thì từ chối ngay, không hiện gì — giống máy bận.
      if (store.active) {
        rejectIncomingCall(payload.callId);
        return;
      }
      store.setIncoming(payload);
    };
    const onJoined = ({ callId, userId, conversationId }: { callId: string; userId: string; conversationId?: string }) => {
      if (conversationId) refreshDetail(conversationId);
      if (useCallStore.getState().active?.callId === callId && userId !== myId) {
        useCallStore.getState().markAnswered();
      }
    };
    const onEnded = ({ callId, conversationId }: { callId: string; conversationId: string }) => {
      refreshDetail(conversationId);
      clearCallIfMatches(callId);
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:participantJoined", onJoined);
    socket.on("call:ended", onEnded);
    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:participantJoined", onJoined);
      socket.off("call:ended", onEnded);
    };
  }, [socket, queryClient, myId]);

  const incomingCallId = incoming?.callId;
  const incomingIsDirect = incoming?.conversationType === "DIRECT";
  useEffect(() => {
    if (!incomingCallId) return;
    if (!incomingIsDirect) {
      // Nhóm: chỉ là banner nhắc, không chuông và không từ chối thay người dùng.
      const timer = window.setTimeout(() => useCallStore.getState().clearIncoming(), GROUP_BANNER_TIMEOUT_MS);
      return () => window.clearTimeout(timer);
    }
    startRingtone();
    const timer = window.setTimeout(() => rejectIncomingCall(incomingCallId), RING_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timer);
      stopRingtone();
    };
  }, [incomingCallId, incomingIsDirect]);

  const activeCallId = active?.callId;
  const activeAnswered = active?.answered;
  useEffect(() => {
    if (!activeCallId || activeAnswered) return;
    const timer = window.setTimeout(() => endActiveCall(), RING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [activeCallId, activeAnswered]);

  return (
    <>
      {incoming &&
        (incoming.conversationType === "DIRECT" ? (
          <IncomingCallOverlay call={incoming} />
        ) : (
          <GroupCallBanner call={incoming} />
        ))}
      {active && <ActiveCallView />}
    </>
  );
}

function IncomingCallOverlay({ call }: { call: IncomingCallPayload }) {
  const name = call.startedBy.displayName;
  const isVideo = call.type === "VIDEO";
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-zinc-900 text-white">
      <UserAvatar name={name} src={call.startedBy.avatarUrl} size="lg" />
      <div className="text-center">
        <p className="text-xl font-semibold">{name}</p>
        <p className="mt-1 text-sm text-white/70">{isVideo ? "Cuộc gọi video đến..." : "Cuộc gọi thoại đến..."}</p>
      </div>
      <div className="flex items-center gap-10">
        <div className="flex flex-col items-center gap-2">
          <Button
            aria-label="Từ chối"
            onClick={() => rejectIncomingCall(call.callId)}
            className="size-14 rounded-full bg-danger hover:bg-danger/90"
          >
            <PhoneOff className="size-6" />
          </Button>
          <span className="text-xs text-white/70">Từ chối</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Button
            aria-label="Chấp nhận"
            onClick={() => acceptIncomingCall(call)}
            className="size-14 rounded-full bg-success hover:bg-success/90"
          >
            {isVideo ? <Video className="size-6" /> : <Phone className="size-6" />}
          </Button>
          <span className="text-xs text-white/70">Chấp nhận</span>
        </div>
      </div>
    </div>
  );
}

function GroupCallBanner({ call }: { call: IncomingCallPayload }) {
  const queryClient = useQueryClient();
  const groupName = queryClient.getQueryData<ConversationDetail>(["conversations", "detail", call.conversationId])?.name;
  const kind = call.type === "VIDEO" ? "video" : "thoại";
  return (
    <div className="fixed bottom-4 right-4 z-40 flex w-80 items-center gap-3 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-lg">
      <UserAvatar name={call.startedBy.displayName} src={call.startedBy.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{call.startedBy.displayName} đang gọi {kind}</p>
        {groupName && <p className="truncate text-xs text-muted-foreground">trong {groupName}</p>}
      </div>
      <Button size="sm" onClick={() => acceptIncomingCall(call)}>
        Tham gia
      </Button>
      <button
        type="button"
        aria-label="Đóng"
        onClick={() => useCallStore.getState().clearIncoming()}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function ActiveCallView() {
  const active = useCallStore((s) => s.active)!;
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const detail = queryClient.getQueryData<ConversationDetail>(["conversations", "detail", active.conversationId]);
  const peer = detail?.members.find((m) => m.id !== myId);
  const title = detail?.type === "DIRECT" ? (peer?.nickname ?? peer?.displayName ?? "Cuộc gọi") : (detail?.name ?? "Cuộc gọi");
  const nameOf = (userId: string) => {
    const member = detail?.members.find((m) => m.id === userId);
    return member?.nickname ?? member?.displayName ?? "Ai đó";
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900 text-white">
      <div className="flex items-center justify-between px-6 py-4">
        <p className="font-medium">{title}</p>
        {!active.answered && <CallStatusLabel label="Đang gọi" />}
      </div>
      <div className="min-h-0 flex-1">
        <CallRoom call={active} onDisconnected={endActiveCall} nameOf={nameOf} />
      </div>
    </div>
  );
}
