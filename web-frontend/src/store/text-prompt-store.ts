import { create } from "zustand";

interface TextPromptOptions {
  title: string;
  initialValue?: string;
  placeholder?: string;
  maxLength?: number;
  submitLabel?: string;
}

interface TextPromptState {
  options: TextPromptOptions | null;
  // Tăng mỗi lần open() — dùng làm React key ép Dialog host remount lại input
  // với đúng initialValue mới, tránh dùng useEffect để sync state (bị lint
  // react-hooks/set-state-in-effect, đúng pattern TextPromptModal bên mobile).
  requestId: number;
  resolve: ((value: string | null) => void) | null;
  open: (options: TextPromptOptions) => Promise<string | null>;
  handleOpenChange: (open: boolean) => void;
}

export const useTextPromptStore = create<TextPromptState>((set, get) => ({
  options: null,
  requestId: 0,
  resolve: null,
  open: (options) =>
    new Promise((resolve) => {
      set((s) => ({ options, resolve, requestId: s.requestId + 1 }));
    }),
  handleOpenChange: (open) => {
    if (open) return;
    get().resolve?.(null);
    set({ options: null, resolve: null });
  },
}));
