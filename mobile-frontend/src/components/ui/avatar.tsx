import { Image } from "expo-image";
import { Text, View } from "react-native";

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  online?: boolean;
}

const INITIAL_BG_COLORS = [
  "#0D9488",
  "#D97706",
  "#2563EB",
  "#DB2777",
  "#7C3AED",
  "#059669",
];

function colorForName(name: string) {
  const code = name.charCodeAt(0) || 0;
  return INITIAL_BG_COLORS[code % INITIAL_BG_COLORS.length];
}

export function Avatar({ uri, name, size = 44, online }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dotSize = Math.max(10, Math.round(size * 0.28));

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colorForName(name),
          }}
          className="items-center justify-center"
        >
          <Text
            style={{ fontSize: size * 0.4 }}
            className="font-semibold text-white"
          >
            {initial}
          </Text>
        </View>
      )}
      {online && (
        <View
          style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2 }}
          className="absolute bottom-0 right-0 border-2 border-white bg-success dark:border-zinc-900 dark:bg-success-dark"
        />
      )}
    </View>
  );
}
