import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";

import { Button, Header, TextField, useToast } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { changePassword } from "@/lib/users";

export default function ChangePassword() {
  const router = useRouter();
  const toast = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => changePassword(oldPassword, newPassword),
    onSuccess: () => {
      toast.show("Đã đổi mật khẩu");
      router.back();
    },
  });

  const errorCode =
    mutation.error instanceof ApiError
      ? (mutation.error.body as { code?: string })?.code
      : undefined;
  const oldPasswordError =
    errorCode === "INVALID_OLD_PASSWORD"
      ? "Mật khẩu hiện tại không đúng"
      : undefined;
  const newPasswordError =
    errorCode === "SAME_PASSWORD"
      ? "Mật khẩu mới phải khác mật khẩu hiện tại"
      : undefined;

  const passwordMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    oldPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !mutation.isPending;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Đổi mật khẩu" />
      <ScrollView
        contentContainerClassName="gap-4 p-6"
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label="Mật khẩu hiện tại"
          value={oldPassword}
          onChangeText={setOldPassword}
          secureTextEntry
          error={oldPasswordError}
        />
        <TextField
          label="Mật khẩu mới"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          error={newPasswordError}
        />
        <Text className="-mt-2 text-xs text-zinc-400">Tối thiểu 8 ký tự.</Text>
        <TextField
          label="Xác nhận mật khẩu mới"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          error={passwordMismatch ? "Mật khẩu xác nhận không khớp" : undefined}
        />

        <Button
          disabled={!canSubmit}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        >
          Lưu
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
