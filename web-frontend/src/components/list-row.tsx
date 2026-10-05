import type { KeyboardEvent, ReactNode } from "react";

interface ListRowProps {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}

// Dùng div thay vì button cho cả hàng — trailing thường chứa nút/menu riêng
// (vd "..."), lồng button trong button là HTML không hợp lệ. stopPropagation
// trên trailing để bấm nút đó không kích hoạt luôn onClick của cả hàng.
export function ListRow({ leading, title, subtitle, trailing, onClick, active }: ListRowProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      // aria-label tường minh để tên accessible của hàng KHÔNG gộp theo nội
      // dung con — trailing thường có button/menu riêng (vd "..."), nếu
      // không có aria-label thì tên hàng sẽ lẫn cả text của nút đó vào,
      // khiến getByRole('button', {name: 'Kết bạn'}) khớp nhầm cả hàng lẫn
      // nút bên trong (phát hiện thật lúc viết test Playwright).
      aria-label={onClick ? title : undefined}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        onClick ? "cursor-pointer hover:bg-accent" : ""
      } ${active ? "bg-accent" : ""}`}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {trailing && (
        <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-2">
          {trailing}
        </div>
      )}
    </div>
  );
}
