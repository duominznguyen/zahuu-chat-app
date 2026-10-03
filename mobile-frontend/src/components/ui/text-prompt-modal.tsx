import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { Button } from "./button";
import { TextField } from "./text-field";

interface TextPromptModalProps {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  maxLength?: number;
  submitLabel?: string;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

interface PromptBodyProps {
  title: string;
  initialValue: string;
  placeholder?: string;
  maxLength?: number;
  submitLabel: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

// Tách riêng để unmount/remount mỗi lần mở lại (xem bên dưới) — state `value`
// vì vậy luôn khởi tạo lại đúng initialValue mới nhất mà không cần effect.
function PromptBody({
  title,
  initialValue,
  placeholder,
  maxLength,
  submitLabel,
  submitting,
  onCancel,
  onSubmit,
}: PromptBodyProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <Pressable
      className="w-full gap-4 rounded-2xl bg-white p-5 dark:bg-zinc-900"
      onPress={(e) => e.stopPropagation()}
    >
      <Text className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </Text>
      <TextField
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus
      />
      <View className="flex-row justify-end gap-2">
        <Button variant="secondary" className="px-5" onPress={onCancel}>
          Hủy
        </Button>
        <Button
          className="px-5"
          disabled={!value.trim()}
          loading={submitting}
          onPress={() => onSubmit(value.trim())}
        >
          {submitLabel}
        </Button>
      </View>
    </Pressable>
  );
}

// Dùng chung cho mọi chỗ cần nhập 1 dòng text xác nhận (đổi tên nhóm, đặt biệt
// danh) — RN không có Alert.prompt trên Android nên phải tự dựng.
export function TextPromptModal({
  visible,
  title,
  initialValue = "",
  placeholder,
  maxLength,
  submitLabel = "Lưu",
  submitting = false,
  onCancel,
  onSubmit,
}: TextPromptModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        className="flex-1 items-center justify-center bg-black/40 px-6"
        onPress={onCancel}
      >
        {visible && (
          <PromptBody
            title={title}
            initialValue={initialValue}
            placeholder={placeholder}
            maxLength={maxLength}
            submitLabel={submitLabel}
            submitting={submitting}
            onCancel={onCancel}
            onSubmit={onSubmit}
          />
        )}
      </Pressable>
    </Modal>
  );
}
