import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Button } from "./button";

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({
  message = "Có lỗi xảy ra, vui lòng thử lại",
  onRetry,
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
      <Text className="text-center text-base text-zinc-500 dark:text-zinc-400">
        {message}
      </Text>
      <Button variant="secondary" onPress={onRetry} className="px-6">
        Thử lại
      </Button>
    </View>
  );
}
