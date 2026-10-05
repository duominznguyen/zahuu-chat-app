import { useLocation } from "react-router-dom";
import { EmptyState } from "@/components/empty-state";
import { FriendsListPane } from "@/components/friends-list-pane";
import { useIsDesktop } from "@/lib/use-media-query";

// Nội dung conversation list làm ở W6 — Bạn bè đã có data thật từ W5.
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
      {isFriends ? (
        <FriendsListPane />
      ) : (
        <>
          <div className="border-b border-border p-4">
            <h2 className="text-lg font-semibold text-foreground">Tin nhắn</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <EmptyState
              title="Chưa có cuộc trò chuyện"
              description="Danh sách thật sẽ hiện ở đây — làm ở milestone sau"
            />
          </div>
        </>
      )}
    </aside>
  );
}
