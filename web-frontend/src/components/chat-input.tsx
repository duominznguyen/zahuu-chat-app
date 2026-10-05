import { Paperclip, Send } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (text: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      <Button
        variant="ghost"
        size="icon"
        aria-label="Đính kèm"
        onClick={() => toast("Gửi ảnh/file sẽ có ở milestone sau")}
      >
        <Paperclip />
      </Button>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          resize();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Nhập tin nhắn..."
        rows={1}
        className="max-h-32 flex-1 resize-none rounded-2xl bg-secondary px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Button
        size="icon"
        aria-label="Gửi"
        disabled={!text.trim()}
        onClick={handleSend}
      >
        <Send />
      </Button>
    </div>
  );
}
