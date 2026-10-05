import type { ReactNode } from "react";

// Bản "độc lập" dùng chung cho các route-modal quản lý nhóm khi mở KHÔNG có
// background (vào thẳng URL) — các action này hiếm khi được chia sẻ link
// trực tiếp nên không cần thiết kế riêng 1 trang đẹp như /u/:userId, chỉ cần
// không vỡ layout (đúng tinh thần mục "Modal route" web-frontend-plan.md).
export function StandalonePageShell({
  title,
  children,
}: {
  // Bỏ qua khi nội dung con đã tự có header riêng (vd GroupMembersContent)
  // để tránh hiện tiêu đề 2 lần.
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="flex h-128 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border">
        {title && (
          <div className="border-b border-border px-4 py-3">
            <p className="font-medium text-foreground">{title}</p>
          </div>
        )}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
