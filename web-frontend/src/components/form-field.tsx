import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
}

export function FormField({ label, error, id, className, ...props }: FormFieldProps) {
  // Tự sinh id nếu không truyền vào — thiếu bước này thì Label không liên kết
  // được với Input (không có htmlFor/id khớp nhau), bấm vào label không focus
  // được input, và trình đọc màn hình/Playwright getByLabel() không tìm thấy.
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <Input id={inputId} aria-invalid={!!error} className={className} {...props} />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
