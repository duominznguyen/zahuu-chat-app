import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/ui/toast";
import { bootstrapAuth } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/store/auth-store";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isReady = useAuthStore((s) => s.isReady);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    bootstrapAuth();
  }, []);

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  // Giữ splash screen hiện tới khi biết chắc có session hay không — tránh
  // nháy qua màn đăng nhập rồi mới chuyển vào app khi thật ra đã có session cũ.
  if (!isReady) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={!!accessToken}>
                <Stack.Screen name="(app)" />
              </Stack.Protected>
              <Stack.Protected guard={!accessToken}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
