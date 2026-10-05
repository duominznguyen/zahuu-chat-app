import { create } from "zustand";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface ConfirmState {
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  open: (options: ConfirmOptions) => Promise<boolean>;
  handleOpenChange: (open: boolean) => void;
}

// Giữ resolve callback của Promise đang chờ trong state (không phải ref) vì
// component host đọc nó qua hook — mọi nơi gọi confirm() chỉ cần await, không
// cần tự quản dialog nào cả.
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  options: null,
  resolve: null,
  open: (options) =>
    new Promise((resolve) => {
      set({ options, resolve });
    }),
  handleOpenChange: (open) => {
    if (open) return;
    get().resolve?.(false);
    set({ options: null, resolve: null });
  },
}));
