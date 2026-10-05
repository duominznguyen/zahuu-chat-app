import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTextPromptStore } from "@/store/text-prompt-store";

// Thân dialog tách riêng, remount theo requestId (key ở component cha) thay
// vì useEffect sync initialValue vào state — state luôn khởi tạo đúng giá trị
// mới mỗi lần mở, không dính lint react-hooks/set-state-in-effect.
function TextPromptBody({
  title,
  initialValue,
  placeholder,
  maxLength,
  submitLabel,
  onSubmit,
}: {
  title: string;
  initialValue: string;
  placeholder?: string;
  maxLength?: number;
  submitLabel: string;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-4"
      />
      <DialogFooter className="mt-6">
        <Button type="submit" disabled={!value.trim()}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TextPromptDialogHost() {
  const options = useTextPromptStore((s) => s.options);
  const requestId = useTextPromptStore((s) => s.requestId);
  const resolve = useTextPromptStore((s) => s.resolve);
  const handleOpenChange = useTextPromptStore((s) => s.handleOpenChange);

  // Nút submit là <button type="submit"> thường trong <form>, không phải
  // Radix Close — không tự đóng dialog khi bấm như AlertDialogAction, phải tự
  // dọn state ngay sau khi resolve với giá trị THẬT (không qua handleOpenChange,
  // vì hàm đó luôn resolve(null) — dành riêng cho nhánh hủy/đóng ngoài ý muốn).
  const handleSubmit = (value: string) => {
    resolve?.(value);
    useTextPromptStore.setState({ options: null, resolve: null });
  };

  return (
    <Dialog open={!!options} onOpenChange={handleOpenChange}>
      <DialogContent>
        {options && (
          <TextPromptBody
            key={requestId}
            title={options.title}
            initialValue={options.initialValue ?? ""}
            placeholder={options.placeholder}
            maxLength={options.maxLength}
            submitLabel={options.submitLabel ?? "Lưu"}
            onSubmit={handleSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
