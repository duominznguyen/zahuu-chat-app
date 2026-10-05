import { Paperclip, Send } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_MEDIA_TYPES } from "@/lib/media";

interface ChatInputProps {
  onSend: (text: string) => void;
  onAttach: (file: File) => void;
  onTypingChange?: (isTyping: boolean) => void;
}

const TYPING_STOP_DELAY_MS = 2000;

export function ChatInput({ onSend, onAttach, onTypingChange }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopTypingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    requestAnimationFrame(resize);
    if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);
    onTypingChange?.(false);
  };

  // Enter gửi, Shift+Enter xuống dòng — isComposing true nghĩa là Enter đang
  // dùng để xác nhận dấu của bộ gõ (vd gõ tiếng Nhật/Hàn/Trung), không phải ý
  // định gửi tin, bỏ qua check này sẽ gửi tin nửa chừng lúc đang gõ dấu.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-border bg-background px-3 py-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_MEDIA_TYPES}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAttach(file);
          e.target.value = ""; // reset để chọn lại đúng file cũ vẫn bắn onChange
        }}
      />
      <Button variant="ghost" size="icon" aria-label="Đính kèm" onClick={() => fileInputRef.current?.click()}>
        <Paperclip />
      </Button>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          resize();
          onTypingChange?.(true);
          if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);
          stopTypingTimeout.current = setTimeout(() => onTypingChange?.(false), TYPING_STOP_DELAY_MS);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Nhập tin nhắn..."
        rows={1}
        className="max-h-32 flex-1 resize-none rounded-2xl bg-secondary px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Button size="icon" aria-label="Gửi" disabled={!text.trim()} onClick={handleSend}>
        <Send />
      </Button>
    </div>
  );
}
