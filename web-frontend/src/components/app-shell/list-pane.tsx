import { useLocation } from "react-router-dom";
import { ConversationListPane } from "@/components/conversation-list-pane";
import { FriendsListPane } from "@/components/friends-list-pane";
import { useIsDesktop } from "@/lib/use-media-query";

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
      {isFriends ? <FriendsListPane /> : <ConversationListPane />}
    </aside>
  );
}
