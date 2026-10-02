import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ChatInputProps {
  onSend: (text: string) => void;
  onAttach?: () => void;
  onTypingChange?: (isTyping: boolean) => void;
}

const TYPING_STOP_DELAY_MS = 2000;

export function ChatInput({
  onSend,
  onAttach,
  onTypingChange,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const insets = useSafeAreaInsets();
  const stopTypingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChangeText = (value: string) => {
    setText(value);
    onTypingChange?.(true);
    if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);
    stopTypingTimeout.current = setTimeout(
      () => onTypingChange?.(false),
      TYPING_STOP_DELAY_MS,
    );
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);
    onTypingChange?.(false);
  };

  return (
    <View
      style={{ paddingBottom: insets.bottom || 8 }}
      className="flex-row items-end gap-2 border-t border-zinc-200 bg-white px-3 pt-2 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <Pressable
        onPress={onAttach}
        className="h-10 w-10 items-center justify-center"
      >
        <Ionicons name="add-circle-outline" size={26} color="#71717a" />
      </Pressable>
      <TextInput
        value={text}
        onChangeText={handleChangeText}
        placeholder="Nhập tin nhắn..."
        placeholderTextColor="#a1a1aa"
        multiline
        className="max-h-28 flex-1 rounded-2xl bg-zinc-100 px-4 py-2.5 text-base text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <Pressable
        onPress={handleSend}
        disabled={!text.trim()}
        className={`h-10 w-10 items-center justify-center rounded-full ${
          text.trim()
            ? "bg-primary dark:bg-primary-dark"
            : "bg-zinc-200 dark:bg-zinc-700"
        }`}
      >
        <Ionicons
          name="send"
          size={18}
          color={text.trim() ? "#fff" : "#a1a1aa"}
        />
      </Pressable>
    </View>
  );
}
