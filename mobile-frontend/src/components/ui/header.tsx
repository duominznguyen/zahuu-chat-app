import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface HeaderProps {
  title: string;
  // Vd "Đang hoạt động" cho DIRECT đang online — dòng nhỏ dưới tên.
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  // Vd mở ConversationInfo khi bấm vào tên/avatar cuộc trò chuyện.
  onTitlePress?: () => void;
}

export function Header({
  title,
  subtitle,
  right,
  onBack,
  onTitlePress,
}: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";

  const titleText = (
    <View className="flex-1">
      <Text
        numberOfLines={1}
        className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
      >
        {title}
      </Text>
      {subtitle && (
        <Text numberOfLines={1} className="text-xs text-zinc-400">
          {subtitle}
        </Text>
      )}
    </View>
  );

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="flex-row items-center border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <Pressable
        onPress={onBack ?? (() => router.back())}
        className="h-12 w-12 items-center justify-center"
      >
        <Ionicons
          name="chevron-back"
          size={26}
          color={isDark ? "#f4f4f5" : "#18181b"}
        />
      </Pressable>
      {onTitlePress ? (
        <Pressable className="flex-1" onPress={onTitlePress}>
          {titleText}
        </Pressable>
      ) : (
        titleText
      )}
      <View className="min-w-12 flex-row items-center justify-end pr-2">
        {right}
      </View>
    </View>
  );
}
