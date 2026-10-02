import { io, type Socket } from "socket.io-client";

import { useAuthStore } from "@/store/auth-store";
import { env } from "./env";

let socket: Socket | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io(env.socketUrl, {
    // Hàm thay vì object tĩnh — để lúc Socket.IO tự reconnect (mất mạng, app
    // quay lại foreground...) luôn gửi access token MỚI NHẤT tại thời điểm đó,
    // không phải token lúc connect lần đầu (access token chỉ sống 15 phút).
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    transports: ["websocket"],
  });
  emitChange();
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  emitChange();
}

export function getSocket(): Socket | null {
  return socket;
}

// Dùng useSyncExternalStore để các component tự re-render khi socket đổi
// (connect/disconnect) — tránh phải nhân bản state này lần nữa bằng useState
// trong 1 effect (gây warning "setState trong effect" không cần thiết).
export function subscribeSocket(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
