import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar, Button } from "@/components/ui";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/store/auth-store";

// M11 sẽ thêm menu đầy đủ (chỉnh sửa hồ sơ, đổi username/mật khẩu, danh sách chặn...).
export default function MeTab() {
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 items-center gap-4 bg-white px-6 pt-10 dark:bg-zinc-950"
    >
      <Avatar name={user?.displayName ?? "?"} uri={user?.avatarUrl} size={88} />
      <View className="items-center gap-1">
        <Text className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {user?.displayName}
        </Text>
        <Text className="text-zinc-500 dark:text-zinc-400">
          @{user?.username}
        </Text>
      </View>
      <View className="w-full pt-6">
        <Button variant="destructive" onPress={() => logout()}>
          Đăng xuất
        </Button>
      </View>
    </SafeAreaView>
  );
}
