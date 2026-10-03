import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import {
  Button,
  ErrorState,
  Header,
  TextField,
  useToast,
} from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { getMe, changeUsername } from "@/lib/users";

const USERNAME_REGEX = /^[a-z0-9_.]{3,30}$/;

export default function ChangeUsername() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");

  const meQuery = useQuery({ queryKey: ["users", "me"], queryFn: getMe });
  const me = meQuery.data;

  const cooldownUntil = me?.usernameChangeAvailableAt
    ? new Date(me.usernameChangeAvailableAt)
    : null;
  const inCooldown = !!cooldownUntil && cooldownUntil > new Date();

  const mutation = useMutation({
    mutationFn: () => changeUsername(username.trim().toLowerCase()),
    onSuccess: (updated) => {
      queryClient.setQueryData(["users", "me"], updated);
      toast.show("Đã đổi username");
      router.back();
    },
  });

  const taken =
    mutation.error instanceof ApiError &&
    (mutation.error.body as { code?: string })?.code === "USERNAME_TAKEN";

  const canSubmit =
    !inCooldown &&
    USERNAME_REGEX.test(username.trim().toLowerCase()) &&
    username.trim().toLowerCase() !== me?.username &&
    !mutation.isPending;

  if (meQuery.isError) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <Header title="Đổi username" />
        <ErrorState onRetry={() => meQuery.refetch()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Đổi username" />
      <View className="gap-4 p-6">
        <Text className="text-zinc-500 dark:text-zinc-400">
          Username hiện tại: @{me?.username}
        </Text>

        {inCooldown ? (
          <Text className="text-sm text-warning dark:text-warning-dark">
            Bạn vừa đổi username gần đây, có thể đổi tiếp từ{" "}
            {cooldownUntil?.toLocaleDateString("vi-VN")}.
          </Text>
        ) : (
          <>
            <TextField
              label="Username mới"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="username"
              error={taken ? "Username đã được sử dụng" : undefined}
            />
            <Text className="text-xs text-zinc-400">
              3-30 ký tự, chỉ gồm chữ thường, số, dấu chấm và gạch dưới.
            </Text>
            <Button
              disabled={!canSubmit}
              loading={mutation.isPending}
              onPress={() => mutation.mutate()}
            >
              Lưu
            </Button>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
