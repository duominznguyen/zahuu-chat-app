import { Stack } from "expo-router";

import { SocketProvider } from "@/providers/socket-provider";

export default function AppLayout() {
  return (
    <SocketProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SocketProvider>
  );
}
