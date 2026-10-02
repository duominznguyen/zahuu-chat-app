import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { Button, Header, TextField } from "@/components/ui";
import { resendOtp, verifyEmail } from "@/lib/auth";

export default function VerifyOtp() {
  const { email, resendAfterSeconds } = useLocalSearchParams<{
    email: string;
    resendAfterSeconds?: string;
  }>();
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(Number(resendAfterSeconds ?? 0));

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(
      () => setCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: () => verifyEmail(email, otp),
    // Thành công -> RootLayout tự chuyển sang (app) khi session có accessToken.
  });

  const resendMutation = useMutation({
    mutationFn: () => resendOtp(email),
    onSuccess: (res) => setCooldown(res.resendAfterSeconds),
  });

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Xác thực email" />
      <View className="gap-4 p-6">
        <Text className="text-zinc-500 dark:text-zinc-400">
          Mã xác thực 6 số đã được gửi tới {email}
        </Text>

        <TextField
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          className="text-center text-2xl tracking-[8px]"
          placeholder="------"
          error={
            verifyMutation.isError
              ? "Mã xác thực không đúng hoặc đã hết hạn"
              : undefined
          }
        />

        <Button
          disabled={otp.length !== 6 || verifyMutation.isPending}
          loading={verifyMutation.isPending}
          onPress={() => verifyMutation.mutate()}
        >
          Xác nhận
        </Button>

        <Pressable
          disabled={cooldown > 0 || resendMutation.isPending}
          onPress={() => resendMutation.mutate()}
          className="items-center py-2"
        >
          <Text
            className={`text-sm font-medium ${
              cooldown > 0
                ? "text-zinc-400"
                : "text-primary dark:text-primary-dark"
            }`}
          >
            {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : "Gửi lại mã"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
