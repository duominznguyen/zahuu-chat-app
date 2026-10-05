import { ArrowLeft } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useIsDesktop } from "@/lib/use-media-query";
import { ListPane } from "./list-pane";
import { Rail } from "./rail";

// "Đang chọn" conversation/friend = path có thêm segment sau /chat hoặc
// /friends (vd /chat/123, /friends/abc) — dùng để quyết định hiện Main Pane
// hay List Pane trên màn hẹp (<1024px), xem mục 3 web-frontend-plan.md.
function useHasMainSelection() {
  const location = useLocation();
  return /^\/(chat|friends)\/.+/.test(location.pathname);
}

export function AppShellLayout() {
  const isDesktop = useIsDesktop();
  const hasMainSelection = useHasMainSelection();
  const location = useLocation();

  if (!isDesktop) {
    if (hasMainSelection) {
      const backTo = location.pathname.startsWith("/friends") ? "/friends" : "/chat";
      return (
        <div className="flex h-screen flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Link
              to={backTo}
              aria-label="Quay lại"
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="size-5" />
            </Link>
          </div>
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-screen">
        <Rail />
        <ListPane />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Rail />
      <ListPane />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
