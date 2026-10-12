import { Ionicons } from "@expo/vector-icons";
import { registerGlobals } from "@livekit/react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/avatar";
import { showToast } from "@/components/ui/toast";
import {
  acceptIncomingCall,
  clearCallIfMatches,
  endActiveCall,
  rejectIncomingCall,
} from "@/lib/call-actions";
import type { IncomingCallPayload } from "@/lib/calls";
import {
  getConversationDetail,
  type ConversationDetail,
} from "@/lib/conversations";
import { startRingtone, stopRingtone } from "@/lib/ringtone";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";
import { useCallStore } from "@/store/call-store";

import { CallRoom, type CallMemberInfo } from "./call-room";

// Gắn WebRTC vào môi trường JS cho livekit-client. Chạy ngay khi module này
// được nạp — module chỉ được nạp trên bản build có native WebRTC.
registerGlobals();

// Không bắt máy / không ai nghe sau 30s thì coi như nhỡ.
const RING_TIMEOUT_MS = 30_000;
// Cuộc gọi nhóm không ép phản hồi — banner tự ẩn, vẫn vào lại được qua banner
// "Cuộc gọi đang diễn ra" trên header conversation.
const GROUP_BANNER_TIMEOUT_MS = 60_000;
// Chừa chỗ cho ChatInput/tab bar để pill và banner không che nút gửi.
const FLOATING_BOTTOM_OFFSET = 88;

export function CallOverlays() {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const hasToken = useAuthStore((s) => !!s.accessToken);
  const active = useCallStore((s) => s.active);
  const incoming = useCallStore((s) => s.incoming);

  useEffect(() => {
    if (!hasToken) {
      useCallStore.getState().clearActive();
      useCallStore.getState().clearIncoming();
    }
  }, [hasToken]);

  useEffect(() => {
    if (!socket) return;
    const refreshDetail = (conversationId: string) =>
      queryClient.invalidateQueries({
        queryKey: ["conversations", "detail", conversationId],
      });

    const onIncoming = (payload: IncomingCallPayload) => {
      refreshDetail(payload.conversationId);
      // Đang trong cuộc gọi khác thì từ chối ngay, không hiện gì — giống máy bận.
      if (useCallStore.getState().active) {
        rejectIncomingCall(payload.callId);
        return;
      }
      useCallStore.getState().setIncoming(payload);
    };
    const onJoined = ({
      callId,
      userId,
      conversationId,
    }: {
      callId: string;
      userId: string;
      conversationId?: string;
    }) => {
      if (conversationId) refreshDetail(conversationId);
      if (
        useCallStore.getState().active?.callId === callId &&
        userId !== myId
      ) {
        useCallStore.getState().markAnswered();
      }
    };
    const onLeft = ({ conversationId }: { conversationId?: string }) => {
      if (conversationId) refreshDetail(conversationId);
    };
    const onEnded = ({
      callId,
      conversationId,
    }: {
      callId: string;
      conversationId: string;
    }) => {
      refreshDetail(conversationId);
      clearCallIfMatches(callId);
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:participantJoined", onJoined);
    socket.on("call:participantLeft", onLeft);
    socket.on("call:ended", onEnded);
    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:participantJoined", onJoined);
      socket.off("call:participantLeft", onLeft);
      socket.off("call:ended", onEnded);
    };
  }, [socket, queryClient, myId]);

  const incomingCallId = incoming?.callId;
  const incomingIsDirect = incoming?.conversationType === "DIRECT";
  useEffect(() => {
    if (!incomingCallId) return;
    if (!incomingIsDirect) {
      // Nhóm: chỉ là banner nhắc, không rung và không từ chối thay người dùng.
      const timer = setTimeout(
        () => useCallStore.getState().clearIncoming(),
        GROUP_BANNER_TIMEOUT_MS,
      );
      return () => clearTimeout(timer);
    }
    startRingtone();
    const timer = setTimeout(
      () => rejectIncomingCall(incomingCallId),
      RING_TIMEOUT_MS,
    );
    return () => {
      clearTimeout(timer);
      stopRingtone();
    };
  }, [incomingCallId, incomingIsDirect]);

  const activeCallId = active?.callId;
  const activeAnswered = active?.answered;
  useEffect(() => {
    if (!activeCallId || activeAnswered) return;
    const timer = setTimeout(() => endActiveCall(), RING_TIMEOUT_MS);
    return () => clearTimeout(timer);
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

// Modal để đè lên cả các Modal khác đang mở (ActionSheet, hộp nhập tên...).
function IncomingCallOverlay({ call }: { call: IncomingCallPayload }) {
  const name = call.startedBy.displayName;
  const isVideo = call.type === "VIDEO";
  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center gap-6 bg-zinc-900">
        <Avatar name={name} uri={call.startedBy.avatarUrl} size={96} />
        <View className="items-center">
          <Text className="text-2xl font-semibold text-white">{name}</Text>
          <Text className="mt-1 text-sm text-white/70">
            {isVideo ? "Cuộc gọi video đến..." : "Cuộc gọi thoại đến..."}
          </Text>
        </View>
        <View className="mt-16 flex-row gap-20">
          <View className="items-center gap-2">
            <Pressable
              accessibilityLabel="Từ chối"
              onPress={() => rejectIncomingCall(call.callId)}
              className="h-16 w-16 items-center justify-center rounded-full bg-danger active:opacity-70"
            >
              <Ionicons
                name="call"
                size={28}
                color="#fff"
                style={{ transform: [{ rotate: "135deg" }] }}
              />
            </Pressable>
            <Text className="text-xs text-white/70">Từ chối</Text>
          </View>
          <View className="items-center gap-2">
            <Pressable
              accessibilityLabel="Chấp nhận"
              onPress={() => acceptIncomingCall(call)}
              className="h-16 w-16 items-center justify-center rounded-full bg-success active:opacity-70"
            >
              <Ionicons
                name={isVideo ? "videocam" : "call"}
                size={28}
                color="#fff"
              />
            </Pressable>
            <Text className="text-xs text-white/70">Chấp nhận</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function GroupCallBanner({ call }: { call: IncomingCallPayload }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const groupName = queryClient.getQueryData<ConversationDetail>([
    "conversations",
    "detail",
    call.conversationId,
  ])?.name;
  const kind = call.type === "VIDEO" ? "video" : "thoại";
  return (
    <View
      style={{ bottom: insets.bottom + FLOATING_BOTTOM_OFFSET }}
      className="absolute left-4 right-4 flex-row items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      <Avatar
        name={call.startedBy.displayName}
        uri={call.startedBy.avatarUrl}
        size={40}
      />
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          {call.startedBy.displayName} đang gọi {kind}
        </Text>
        {groupName && (
          <Text
            numberOfLines={1}
            className="text-xs text-zinc-500 dark:text-zinc-400"
          >
            trong {groupName}
          </Text>
        )}
      </View>
      <Pressable
        onPress={() => acceptIncomingCall(call)}
        className="rounded-full bg-primary px-3 py-1.5 active:opacity-70 dark:bg-primary-dark"
      >
        <Text className="text-sm font-semibold text-white dark:text-zinc-900">
          Tham gia
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Đóng"
        hitSlop={8}
        onPress={() => useCallStore.getState().clearIncoming()}
      >
        <Ionicons name="close" size={20} color="#71717a" />
      </Pressable>
    </View>
  );
}

function ActiveCallView() {
  const active = useCallStore((s) => s.active)!;
  const minimized = useCallStore((s) => s.minimized);
  const myId = useAuthStore((s) => s.user?.id);
  const insets = useSafeAreaInsets();
  // useQuery thay vì đọc cache: nhận cuộc gọi khi chưa từng mở đoạn chat đó thì
  // cache chưa có, vẫn cần tên/avatar thành viên.
  const { data: detail } = useQuery({
    queryKey: ["conversations", "detail", active.conversationId],
    queryFn: () => getConversationDetail(active.conversationId),
  });

  const peer = detail?.members.find((m) => m.id !== myId);
  const title =
    detail?.type === "DIRECT"
      ? (peer?.nickname ?? peer?.displayName ?? "Cuộc gọi")
      : (detail?.name ?? "Cuộc gọi");
  const memberOf = (userId: string): CallMemberInfo => {
    const member = detail?.members.find((m) => m.id === userId);
    return {
      name: member?.nickname ?? member?.displayName ?? "Ai đó",
      avatarUrl: member?.avatarUrl ?? null,
    };
  };

  // Đổi style container, giữ nguyên cây con: phòng LiveKit không bị unmount
  // khi thu nhỏ/mở lại. className cố định, chỉ `style` thay đổi — NativeWind
  // "nâng cấp" component khi className đổi sang nhóm class khác (bo góc, đổ
  // bóng) và ở dev mode việc đó đọc navigation context, mà overlay này nằm
  // ngoài navigator nên sẽ crash.
  return (
    <View
      style={
        minimized
          ? {
              left: 16,
              right: 16,
              height: 64,
              bottom: insets.bottom + FLOATING_BOTTOM_OFFSET,
              borderRadius: 16,
              elevation: 8,
            }
          : {
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            }
      }
      className="absolute overflow-hidden bg-zinc-900"
    >
      {!minimized && (
        <View className="flex-row items-center justify-between px-4 py-3">
          <View className="flex-1">
            <Text numberOfLines={1} className="text-lg font-semibold text-white">
              {title}
            </Text>
            {!active.answered && (
              <Text className="text-sm text-white/70">Đang gọi...</Text>
            )}
          </View>
          <Pressable
            accessibilityLabel="Thu nhỏ cuộc gọi"
            hitSlop={8}
            onPress={() => useCallStore.getState().minimizeCall()}
          >
            <Ionicons name="chevron-down" size={26} color="#fff" />
          </Pressable>
        </View>
      )}
      <View className="flex-1">
        <CallRoom
          call={active}
          minimized={minimized}
          title={title}
          memberOf={memberOf}
          onLeave={endActiveCall}
          onDisconnected={endActiveCall}
          onConnectError={() => {
            showToast("Không kết nối được cuộc gọi, vui lòng thử lại");
            endActiveCall();
          }}
          onRestore={() => useCallStore.getState().restoreCall()}
        />
      </View>
    </View>
  );
}
