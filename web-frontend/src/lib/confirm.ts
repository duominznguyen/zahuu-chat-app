import { useConfirmStore } from "@/store/confirm-store";

// Tương đương ergonomic confirm() bên mobile (wrap Alert.alert) — dựng trên
// shadcn AlertDialog qua <ConfirmDialogHost /> mount sẵn ở root, mọi nơi cần
// xác nhận hành động phá hủy gọi thẳng hàm này, KHÔNG tự viết useState +
// Dialog riêng lẻ.
export function confirm(options: {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return useConfirmStore.getState().open(options);
}
