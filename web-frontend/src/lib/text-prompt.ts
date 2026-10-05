import { useTextPromptStore } from "@/store/text-prompt-store";

// Tương đương TextPromptModal bên mobile — web không có Alert.prompt nào để
// wrap nên tự dựng trên shadcn Dialog, trả Promise<string | null> (null khi
// hủy) để gọi gọn như `const value = await textPrompt({...}); if (value) ...`.
export function textPrompt(options: {
  title: string;
  initialValue?: string;
  placeholder?: string;
  maxLength?: number;
  submitLabel?: string;
}): Promise<string | null> {
  return useTextPromptStore.getState().open(options);
}
