import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui";

// M5/M6 sẽ thay nội dung này bằng ChatsList thật (GET /conversations + socket realtime).
export default function ChatsTab() {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-zinc-950">
      <View className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <Text className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Tin nhắn
        </Text>
      </View>
      <EmptyState title="Chưa có cuộc trò chuyện nào" />
    </SafeAreaView>
  );
}
