import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button, Header, TextField } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { register } from "@/lib/auth";

const METHOD_LABEL: Record<string, string> = {
  PASSWORD: "mật khẩu",
  GOOGLE: "Google",
};

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => register(email.trim(), displayName.trim(), password),
    onSuccess: (res) => {
      router.push({
        pathname: "/verify-otp",
        params: {
          email: email.trim(),
          resendAfterSeconds: String(res.resendAfterSeconds),
        },
      });
    },
  });

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit =
    email.trim().length > 0 &&
    displayName.trim().length > 0 &&
    password.length >= 8 &&
    password === confirmPassword &&
    !mutation.isPending;

  const emailExists =
    mutation.error instanceof ApiError &&
    (mutation.error.body as { code?: string })?.code === "EMAIL_EXISTS";
  const existingMethods = emailExists
    ? ((mutation.error as ApiError).body as { methods: string[] }).methods
    : [];

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Đăng ký" />
      <ScrollView
        contentContainerClassName="gap-4 p-6"
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextField
          label="Tên hiển thị"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextField
          label="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
        />
        <TextField
          label="Xác nhận mật khẩu"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          error={passwordMismatch ? "Mật khẩu xác nhận không khớp" : undefined}
        />

        {emailExists && (
          <View className="gap-2 rounded-xl bg-warning/10 p-3">
            <Text className="text-sm text-zinc-700 dark:text-zinc-300">
              Email này đã đăng ký bằng{" "}
              {existingMethods.map((m) => METHOD_LABEL[m] ?? m).join(" hoặc ")}.
            </Text>
            <Pressable onPress={() => router.push("/login")}>
              <Text className="text-sm font-semibold text-primary dark:text-primary-dark">
                Đăng nhập ngay
              </Text>
            </Pressable>
          </View>
        )}
        {mutation.isError && !emailExists && (
          <Text className="text-sm text-danger dark:text-danger-dark">
            Không thể đăng ký, vui lòng thử lại
          </Text>
        )}

        <Button
          disabled={!canSubmit}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        >
          Đăng ký
        </Button>

        <View className="flex-row justify-center gap-1 pt-2">
          <Text className="text-zinc-500 dark:text-zinc-400">
            Đã có tài khoản?
          </Text>
          <Pressable onPress={() => router.push("/login")}>
            <Text className="font-medium text-primary dark:text-primary-dark">
              Đăng nhập
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
