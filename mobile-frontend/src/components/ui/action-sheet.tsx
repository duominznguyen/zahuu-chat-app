import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  items: ActionSheetItem[];
  // Slot tùy chỉnh phía trên list item — dùng cho dãy icon reaction trên màn Conversation.
  header?: ReactNode;
}

export function ActionSheet({
  visible,
  onClose,
  items,
  header,
}: ActionSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <View
          style={{ paddingBottom: insets.bottom + 8 }}
          className="absolute bottom-0 w-full rounded-t-2xl bg-white dark:bg-zinc-900"
        >
          {header}
          {items.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              className="flex-row items-center gap-3 border-b border-zinc-100 px-5 py-4 last:border-b-0 dark:border-zinc-800"
            >
              {item.icon && (
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.destructive ? "#DC2626" : "#71717a"}
                />
              )}
              <Text
                className={`text-base ${
                  item.destructive
                    ? "text-danger dark:text-danger-dark"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
