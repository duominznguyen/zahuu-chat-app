import { Alert } from "react-native";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

// Dùng dialog gốc của hệ điều hành (quen thuộc với người dùng, không cần tự
// dựng UI) — trả Promise<boolean> để gọi dễ như `if (await confirm(...))`.
export function confirm({
  title,
  message,
  confirmLabel = "Đồng ý",
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Hủy", style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      // Android cho phép đóng dialog bằng nút back/chạm ra ngoài mà không bấm
      // nút nào — phải tự resolve(false), không thì Promise treo mãi.
      { onDismiss: () => resolve(false) },
    );
  });
}
