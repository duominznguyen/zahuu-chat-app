import { Text, View } from "react-native";

import { Avatar } from "@/components/ui";
import type { SeenBy } from "@/lib/conversations";

const AVATAR_SIZE = 16;

// Backend đã cắt `users` còn tối đa 5 — ở đây chỉ hiện phần dư thành "+N".
export function SeenByRow({ seenBy }: { seenBy: SeenBy }) {
  const hiddenCount = seenBy.count - seenBy.users.length;
  const names = seenBy.users.map((u) => u.displayName).join(", ");

  return (
    <View
      accessibilityLabel={`Đã xem bởi ${names}`}
      className="-mt-1 mb-3 flex-row items-center justify-end"
    >
      {seenBy.users.map((user, index) => (
        <View
          key={user.id}
          // Viền cùng màu nền để các avatar chồng nhau vẫn tách bạch.
          className="rounded-full border-2 border-white dark:border-zinc-950"
          style={index > 0 ? { marginLeft: -6 } : undefined}
        >
          <Avatar name={user.displayName} uri={user.avatarUrl} size={AVATAR_SIZE} />
        </View>
      ))}
      {hiddenCount > 0 && (
        <Text className="ml-1 text-xs text-zinc-400">+{hiddenCount}</Text>
      )}
    </View>
  );
}
