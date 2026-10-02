import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import { Button, Header, TextField } from "@/components/ui";
import { forgotPassword } from "@/lib/auth";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: () => forgotPassword(email.trim()),
  });

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Quên mật khẩu" />
      <View className="gap-4 p-6">
        <Text className="text-zinc-500 dark:text-zinc-400">
          Nhập email để nhận mã đặt lại mật khẩu
        </Text>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!mutation.isSuccess}
        />

        {mutation.isSuccess && (
          <Text className="text-sm text-success dark:text-success-dark">
            Nếu email đã đăng ký, mã đặt lại mật khẩu đã được gửi.
          </Text>
        )}

        {!mutation.isSuccess ? (
          <Button
            disabled={email.trim().length === 0 || mutation.isPending}
            loading={mutation.isPending}
            onPress={() => mutation.mutate()}
          >
            Gửi mã
          </Button>
        ) : (
          <Button
            onPress={() =>
              router.push({
                pathname: "/reset-password",
                params: { email: email.trim() },
              })
            }
          >
            Tôi đã nhận được mã
          </Button>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
