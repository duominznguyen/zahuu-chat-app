import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";

import { Button, Header, TextField, useToast } from "@/components/ui";
import { resetPassword } from "@/lib/auth";

export default function ResetPassword() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const toast = useToast();
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => resetPassword(email, otp, newPassword),
    onSuccess: () => {
      toast.show("Đặt lại mật khẩu thành công, hãy đăng nhập lại");
      router.replace("/login");
    },
  });

  const passwordMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    otp.length === 6 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !mutation.isPending;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Đặt lại mật khẩu" />
      <ScrollView
        contentContainerClassName="gap-4 p-6"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-zinc-500 dark:text-zinc-400">
          Nhập mã đã gửi tới {email}
        </Text>

        <TextField
          label="Mã xác thực"
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          error={mutation.isError ? "Mã không đúng hoặc đã hết hạn" : undefined}
        />
        <TextField
          label="Mật khẩu mới"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
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
          Đặt lại mật khẩu
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
