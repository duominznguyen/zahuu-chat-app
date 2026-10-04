import { io, type Socket } from "socket.io-client";
import { env } from "./env";

let socket: Socket | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io(env.socketUrl, {
    // KHÔNG truyền auth.token (khác mobile) — cookie accessToken tự gửi kèm
    // handshake, withCredentials đảm bảo trình duyệt đính kèm nó dù same-site
    // mặc định có lẽ đã đủ. Nhờ cookie tự gửi + timer làm mới định kỳ
    // (token-refresh.ts) giữ cookie luôn còn hạn, không cần hàm callback lấy
    // token mới nhất như mobile phải làm.
    withCredentials: true,
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

// Dùng useSyncExternalStore để component tự re-render khi socket đổi
// (connect/disconnect) — tránh phải nhân bản state này bằng useState trong 1
// effect (gây warning "setState trong effect" không cần thiết).
export function subscribeSocket(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
