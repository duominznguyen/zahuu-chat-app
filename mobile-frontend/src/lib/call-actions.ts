import { showToast } from "@/components/ui/toast";
import { useCallStore } from "@/store/call-store";

import { ApiError } from "./api-client";
import { ensureCallPermissions } from "./call-permissions";
import {
  declineCall,
  joinCall,
  leaveCall,
  startCall,
  type CallType,
  type IncomingCallPayload,
} from "./calls";

function errorCodeOf(err: unknown) {
  return err instanceof ApiError
    ? (err.body as { code?: string } | undefined)?.code
    : undefined;
}

export async function beginCall(conversationId: string, type: CallType) {
  if (useCallStore.getState().active) {
    showToast("Bạn đang trong một cuộc gọi khác");
    return;
  }
  if (!(await ensureCallPermissions(type))) {
    showToast("Cần quyền micro/camera để gọi");
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
    showToast(
      errorCodeOf(err) === "CALL_IN_PROGRESS"
        ? "Cuộc trò chuyện này đang có cuộc gọi"
        : "Không bắt đầu được cuộc gọi, vui lòng thử lại",
    );
  }
}

export async function joinExistingCall(
  callId: string,
  conversationId: string,
  type: CallType,
) {
  const store = useCallStore.getState();
  if (!(await ensureCallPermissions(type))) {
    showToast("Cần quyền micro/camera để tham gia cuộc gọi");
    // Cuộc gọi tới đang đổ chuông: từ chối luôn để người gọi không phải chờ hết giờ.
    if (store.incoming?.callId === callId) rejectIncomingCall(callId);
    return;
  }
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
    showToast(
      errorCodeOf(err) === "CALL_ENDED"
        ? "Cuộc gọi đã kết thúc"
        : "Không tham gia được cuộc gọi",
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

// clearActive trước khi gọi /leave: lần disconnect lặp lại từ LiveKit (khi
// phòng unmount) sẽ thấy store đã rỗng và không gửi /leave lần nữa.
export function endActiveCall() {
  const active = useCallStore.getState().active;
  if (!active) return;
  useCallStore.getState().clearActive();
  leaveCall(active.callId).catch(() => {});
}

// Cuộc gọi đã kết thúc phía server (socket call:ended) — không cần /leave nữa.
export function clearCallIfMatches(callId: string) {
  const store = useCallStore.getState();
  if (store.active?.callId === callId) store.clearActive();
  if (store.incoming?.callId === callId) store.clearIncoming();
}
