import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  Button,
  ErrorState,
  Header,
  TextField,
  useToast,
} from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { deactivateAccount, getMe } from "@/lib/users";

export default function DeactivateAccount() {
  const toast = useToast();
  const meQuery = useQuery({ queryKey: ["users", "me"], queryFn: getMe });
  const me = meQuery.data;

  const mutation = useMutation({
    mutationFn: (password?: string) => deactivateAccount(password),
    // Thành công -> clearSession() (trong deactivateAccount()) tự đổi accessToken
    // về null, Stack.Protected ở root tự chuyển sang (auth) ngay, không cần tự
    // điều hướng ở đây.
    onError: () => toast.show("Vô hiệu hóa thất bại, vui lòng thử lại"),
  });

  const errorCode =
    mutation.error instanceof ApiError
      ? (mutation.error.body as { code?: string })?.code
      : undefined;
  const passwordError =
    errorCode === "INVALID_PASSWORD" ? "Mật khẩu không đúng" : undefined;

  if (meQuery.isError) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <Header title="Vô hiệu hóa tài khoản" />
        <ErrorState onRetry={() => meQuery.refetch()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Vô hiệu hóa tài khoản" />
      <ScrollView
        contentContainerClassName="gap-4 p-6"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-base text-zinc-700 dark:text-zinc-300">
          Tài khoản của bạn sẽ bị ẩn khỏi mọi người, bạn sẽ không thể đăng nhập
          bằng tài khoản này cho tới khi kích hoạt lại.
        </Text>
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
          Đăng nhập lại bất cứ lúc nào để kích hoạt lại tài khoản.
        </Text>

        {me?.hasPassword && (
          <PasswordConfirmForm
            error={passwordError}
            loading={mutation.isPending}
            onConfirm={(password) => mutation.mutate(password)}
          />
        )}
        {me && !me.hasPassword && (
          <Button
            variant="destructive"
            loading={mutation.isPending}
            onPress={() => mutation.mutate(undefined)}
          >
            Vô hiệu hóa tài khoản
          </Button>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PasswordConfirmForm({
  error,
  loading,
  onConfirm,
}: {
  error?: string;
  loading: boolean;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  return (
    <View className="gap-4">
      <TextField
        label="Nhập mật khẩu để xác nhận"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        error={error}
      />
      <Button
        variant="destructive"
        disabled={password.length === 0 || loading}
        loading={loading}
        onPress={() => onConfirm(password)}
      >
        Vô hiệu hóa tài khoản
      </Button>
    </View>
  );
}
