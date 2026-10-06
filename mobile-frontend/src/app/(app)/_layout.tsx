import { Stack } from "expo-router";

import { isCallingSupported } from "@/lib/calling-support";
import { SocketProvider } from "@/providers/socket-provider";

// require có điều kiện thay vì import tĩnh: chỉ nạp module gọi điện (kéo theo
// native WebRTC) trên bản build hỗ trợ, nạp trên Expo Go/web sẽ crash cả app.
const CallOverlays: (typeof import("@/components/call/call-overlays"))["CallOverlays"] | null =
  isCallingSupported
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/components/call/call-overlays").CallOverlays
    : null;

export default function AppLayout() {
  return (
    <SocketProvider>
      <Stack screenOptions={{ headerShown: false }} />
      {/* Nằm sau Stack để đè lên mọi màn, cuộc gọi sống khi chuyển màn. */}
      {CallOverlays && <CallOverlays />}
    </SocketProvider>
  );
}
