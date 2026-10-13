import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

import { Header, ListRow } from "@/components/ui";
import {
  setThemePreference,
  useThemeStore,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: "light",
    label: "Sáng",
    description: "Luôn dùng giao diện sáng",
    icon: "sunny-outline",
  },
  {
    value: "dark",
    label: "Tối",
    description: "Luôn dùng giao diện tối",
    icon: "moon-outline",
  },
  {
    value: "system",
    label: "Theo hệ thống",
    description: "Tự đổi theo cài đặt của điện thoại",
    icon: "phone-portrait-outline",
  },
];

export default function Appearance() {
  const preference = useThemeStore((s) => s.preference);

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Giao diện" />
      <View className="pt-2">
        {OPTIONS.map((option) => {
          const selected = preference === option.value;
          return (
            <ListRow
              key={option.value}
              leading={
                <Ionicons name={option.icon} size={22} color="#71717a" />
              }
              title={option.label}
              subtitle={option.description}
              trailing={
                selected ? (
                  <Ionicons name="checkmark" size={22} color="#0D9488" />
                ) : undefined
              }
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              aria-checked={selected}
              onPress={() => void setThemePreference(option.value)}
            />
          );
        })}
      </View>
    </View>
  );
}
