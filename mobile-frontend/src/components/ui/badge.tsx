import { Text, View } from "react-native";

interface BadgeProps {
  count: number;
  max?: number;
}

export function Badge({ count, max = 99 }: BadgeProps) {
  if (count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);

  return (
    <View className="min-w-[18px] items-center justify-center rounded-full bg-danger px-1 py-0.5 dark:bg-danger-dark">
      <Text className="text-xs font-semibold text-white">{label}</Text>
    </View>
  );
}

// Chấm nhỏ không có số, dùng khi chỉ cần báo "có cái mới" (vd unread trên ChatsList row)
export function Dot() {
  return (
    <View className="h-2.5 w-2.5 rounded-full bg-primary dark:bg-primary-dark" />
  );
}
