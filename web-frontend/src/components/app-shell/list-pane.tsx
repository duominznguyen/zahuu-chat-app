import { useLocation } from "react-router-dom";
import { EmptyState } from "@/components/empty-state";
import { useIsDesktop } from "@/lib/use-media-query";

// Nội dung thật (conversation list / friends list) làm ở W5-W6 — khung pane
// + chuyển nội dung theo mục đang chọn ở Rail là phần việc của W4.
export function ListPane() {
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const isFriends = location.pathname.startsWith("/friends");

  return (
    <aside
      className={`flex h-screen flex-col border-r border-border bg-background ${
        isDesktop ? "w-[360px] shrink-0" : "flex-1"
      }`}
    >
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isFriends ? "Bạn bè" : "Tin nhắn"}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EmptyState
          title={isFriends ? "Chưa có bạn bè" : "Chưa có cuộc trò chuyện"}
          description="Danh sách thật sẽ hiện ở đây — làm ở milestone sau"
        />
      </div>
    </aside>
  );
}
