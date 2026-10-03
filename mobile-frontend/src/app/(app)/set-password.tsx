import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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
import { forgotPassword, resetPassword } from "@/lib/auth";
import { getMe } from "@/lib/users";

// Tài khoản chỉ đăng nhập bằng Google muốn đặt mật khẩu thì dùng lại đúng
// flow OTP của ForgotPassword/ResetPassword (backend hỗ trợ sẵn) — nhưng màn
// đó nằm trong nhóm route (auth), không điều hướng được từ (app) vì
// Stack.Protected chặn theo accessToken. Màn riêng này tự gói gọn 2 bước lại,
// email đã biết sẵn từ /users/me nên không cần hỏi lại.
export default function SetPassword() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const meQuery = useQuery({ queryKey: ["users", "me"], queryFn: getMe });
  const email = meQuery.data?.email;

  const sendOtpMutation = useMutation({
    mutationFn: () => forgotPassword(email!),
    onSuccess: () => setOtpSent(true),
  });

  const setPasswordMutation = useMutation({
    mutationFn: () => resetPassword(email!, otp, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
      toast.show("Đã đặt mật khẩu");
      router.back();
    },
    onError: () => toast.show("Mã không đúng hoặc đã hết hạn"),
  });

  const passwordMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    otp.length === 6 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !setPasswordMutation.isPending;

  if (meQuery.isError) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <Header title="Đặt mật khẩu" />
        <ErrorState onRetry={() => meQuery.refetch()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Đặt mật khẩu" />
      <ScrollView
        contentContainerClassName="gap-4 p-6"
        keyboardShouldPersistTaps="handled"
      >
        {!otpSent ? (
          <>
            <Text className="text-zinc-500 dark:text-zinc-400">
              Gửi mã xác thực tới {email} để đặt mật khẩu cho tài khoản.
            </Text>
            <Button
              loading={sendOtpMutation.isPending}
              disabled={!email || sendOtpMutation.isPending}
              onPress={() => sendOtpMutation.mutate()}
            >
              Gửi mã
            </Button>
          </>
        ) : (
          <>
            <Text className="text-zinc-500 dark:text-zinc-400">
              Nhập mã đã gửi tới {email}
            </Text>
            <TextField
              label="Mã xác thực"
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
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
              error={
                passwordMismatch ? "Mật khẩu xác nhận không khớp" : undefined
              }
            />
            <Button
              disabled={!canSubmit}
              loading={setPasswordMutation.isPending}
              onPress={() => setPasswordMutation.mutate()}
            >
              Đặt mật khẩu
            </Button>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
