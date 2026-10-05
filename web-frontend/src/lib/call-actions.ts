import { toast } from "sonner";
import { ApiError } from "./api-client";
import { declineCall, joinCall, leaveCall, startCall, type CallType, type IncomingCallPayload } from "./calls";
import { useCallStore } from "@/store/call-store";

function errorCodeOf(err: unknown) {
  return err instanceof ApiError ? (err.body as { code?: string } | undefined)?.code : undefined;
}

export async function beginCall(conversationId: string, type: CallType) {
  if (useCallStore.getState().active) {
    toast.info("Bạn đang trong một cuộc gọi khác");
    return;
  }
  try {
    const session = await startCall(conversationId, type);
    useCallStore.getState().setActive({
      callId: session.callId,
      conversationId,
      type: session.type,
      livekitRoomName: session.livekitRoomName,
      livekitToken: session.livekitToken,
      livekitUrl: session.livekitUrl,
      answered: false,
    });
  } catch (err) {
    if (errorCodeOf(err) === "CALL_IN_PROGRESS") {
      toast.info("Cuộc trò chuyện này đang có cuộc gọi");
      return;
    }
    toast.error("Không bắt đầu được cuộc gọi, vui lòng thử lại");
  }
}

export async function joinExistingCall(callId: string, conversationId: string, type: CallType) {
  const store = useCallStore.getState();
  try {
    const session = await joinCall(callId);
    store.setActive({
      callId,
      conversationId,
      type,
      livekitRoomName: session.livekitRoomName,
      livekitToken: session.livekitToken,
      livekitUrl: session.livekitUrl,
      answered: true,
    });
  } catch (err) {
    toast.error(
      errorCodeOf(err) === "CALL_ENDED" ? "Cuộc gọi đã kết thúc" : "Không tham gia được cuộc gọi",
    );
  } finally {
    store.clearIncoming();
  }
}

export function acceptIncomingCall(incoming: IncomingCallPayload) {
  void joinExistingCall(incoming.callId, incoming.conversationId, incoming.type);
}

export function rejectIncomingCall(callId: string) {
  useCallStore.getState().clearIncoming();
  declineCall(callId).catch(() => {});
}

// Gọi khi người dùng rời phòng: clearActive trước để lần disconnect lặp lại từ
// LiveKit (unmount phòng) không gửi /leave thêm lần nữa.
export function endActiveCall() {
  const active = useCallStore.getState().active;
  if (!active) return;
  useCallStore.getState().clearActive();
  leaveCall(active.callId).catch(() => {});
}

// Cuộc gọi đã kết thúc phía server (socket call:ended) — không cần gọi /leave nữa.
export function clearCallIfMatches(callId: string) {
  const store = useCallStore.getState();
  if (store.active?.callId === callId) store.clearActive();
  if (store.incoming?.callId === callId) store.clearIncoming();
}
