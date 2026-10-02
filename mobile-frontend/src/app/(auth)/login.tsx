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

import { Button, Header, TextField, useToast } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { login } from "@/lib/auth";

export default function Login() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: (res) => {
      if (res.reactivated) toast.show("Tài khoản đã được kích hoạt lại");
      // Không cần tự điều hướng — RootLayout tự chuyển sang (app) khi accessToken đổi.
    },
  });

  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !mutation.isPending;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Đăng nhập" />
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
          label="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <Pressable
          onPress={() => router.push("/forgot-password")}
          className="self-end"
        >
          <Text className="text-sm font-medium text-primary dark:text-primary-dark">
            Quên mật khẩu?
          </Text>
        </Pressable>

        {mutation.isError && (
          <Text className="text-sm text-danger dark:text-danger-dark">
            {mutation.error instanceof ApiError
              ? "Sai email hoặc mật khẩu"
              : "Không kết nối được máy chủ, vui lòng thử lại"}
          </Text>
        )}

        <Button
          disabled={!canSubmit}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        >
          Đăng nhập
        </Button>

        <View className="flex-row justify-center gap-1 pt-2">
          <Text className="text-zinc-500 dark:text-zinc-400">
            Chưa có tài khoản?
          </Text>
          <Pressable onPress={() => router.push("/register")}>
            <Text className="font-medium text-primary dark:text-primary-dark">
              Đăng ký
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
