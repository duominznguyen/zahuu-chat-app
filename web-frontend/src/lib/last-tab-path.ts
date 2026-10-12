export type RailTab = "chat" | "friends";

const DEFAULT_PATHS: Record<RailTab, string> = { chat: "/chat", friends: "/friends" };

// Module-level thay vì state của Rail: Rail bị unmount khi mở /settings hoặc
// trên màn hẹp đang xem Main Pane, nhưng vẫn phải nhớ đoạn chat/hồ sơ đang mở.
let lastPaths = { ...DEFAULT_PATHS };

export function getLastTabPath(tab: RailTab) {
  return lastPaths[tab];
}

export function setLastTabPath(tab: RailTab, path: string) {
  lastPaths[tab] = path;
}

export function resetLastTabPaths() {
  lastPaths = { ...DEFAULT_PATHS };
}
