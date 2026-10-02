import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Button } from "./button";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function EmptyState({
  icon = "file-tray-outline",
  title,
  ctaLabel,
  onPressCta,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Ionicons name={icon} size={48} color="#a1a1aa" />
      <Text className="text-center text-base text-zinc-500 dark:text-zinc-400">
        {title}
      </Text>
      {ctaLabel && onPressCta && (
        <Button variant="secondary" onPress={onPressCta} className="px-6">
          {ctaLabel}
        </Button>
      )}
    </View>
  );
}
