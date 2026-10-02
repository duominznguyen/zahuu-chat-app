import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar, Button } from "@/components/ui";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/store/auth-store";

// Placeholder tối thiểu để test được trọn luồng auth — M4 (App shell) sẽ thay
// bằng bottom tabs Chats/Friends/Me thật.
export default function AppHome() {
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white dark:bg-zinc-950">
      <Avatar name={user?.displayName ?? "?"} uri={user?.avatarUrl} size={72} />
      <Text className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {user?.displayName}
      </Text>
      <Text className="text-zinc-500 dark:text-zinc-400">
        @{user?.username}
      </Text>
      <View className="w-full px-10 pt-6">
        <Button variant="destructive" onPress={() => logout()}>
          Đăng xuất
        </Button>
      </View>
    </SafeAreaView>
  );
}
