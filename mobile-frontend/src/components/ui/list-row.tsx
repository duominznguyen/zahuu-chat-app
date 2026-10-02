import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

interface ListRowProps {
  leading?: ReactNode;
  title: string;
  titleClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function ListRow({
  leading,
  title,
  titleClassName,
  subtitle,
  subtitleClassName,
  trailing,
  onPress,
  onLongPress,
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-zinc-100 dark:active:bg-zinc-800"
    >
      {leading}
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className={`text-base text-zinc-900 dark:text-zinc-100 ${titleClassName ?? ""}`}
        >
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text
            numberOfLines={1}
            className={`text-sm text-zinc-500 dark:text-zinc-400 ${subtitleClassName ?? ""}`}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </Pressable>
  );
}
