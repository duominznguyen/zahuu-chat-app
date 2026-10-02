import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import {
  connectSocket,
  disconnectSocket,
  getSocket,
  subscribeSocket,
} from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";

export function useSocket() {
  return useSyncExternalStore(subscribeSocket, getSocket);
}

// Chỉ phụ thuộc CÓ token hay không (boolean), không phụ thuộc giá trị token —
// access token đổi mỗi lần refresh (15 phút/lần) nhưng không cần reconnect lại
// socket mỗi lần đó, chỉ cần connect lúc đăng nhập và disconnect lúc đăng xuất.
export function SocketProvider({ children }: { children: ReactNode }) {
  const hasToken = useAuthStore((s) => !!s.accessToken);

  useEffect(() => {
    if (!hasToken) return;
    connectSocket();
    return () => disconnectSocket();
  }, [hasToken]);

  return children;
}
