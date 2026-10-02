import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, useToast } from "@/components/ui";

export default function Welcome() {
  const router = useRouter();
  const toast = useToast();

  return (
    <SafeAreaView className="flex-1 bg-white px-6 dark:bg-zinc-950">
      <View className="flex-1 items-center justify-center gap-2">
        <Text className="text-4xl font-bold text-primary dark:text-primary-dark">
          Zahuu
        </Text>
        <Text className="text-base text-zinc-500 dark:text-zinc-400">
          Nhắn tin mọi lúc, mọi nơi
        </Text>
      </View>

      <View className="gap-3 pb-6">
        <Button onPress={() => router.push("/login")}>Đăng nhập</Button>
        <Button variant="secondary" onPress={() => router.push("/register")}>
          Đăng ký
        </Button>

        <View className="flex-row items-center gap-3 py-2">
          <View className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <Text className="text-sm text-zinc-400">hoặc</Text>
          <View className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </View>

        <Button
          variant="ghost"
          className="border border-zinc-200 dark:border-zinc-800"
          onPress={() => toast.show("Đăng nhập Google sẽ sớm có mặt")}
        >
          Tiếp tục với Google
        </Button>
      </View>
    </SafeAreaView>
  );
}
