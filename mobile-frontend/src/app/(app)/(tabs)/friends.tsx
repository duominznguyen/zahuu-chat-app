import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui";

// M5 sẽ thay nội dung này bằng FriendsList thật (GET /friends).
export default function FriendsTab() {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-zinc-950">
      <View className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <Text className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Bạn bè
        </Text>
      </View>
      <EmptyState title="Chưa có bạn bè nào" icon="people-outline" />
    </SafeAreaView>
  );
}
