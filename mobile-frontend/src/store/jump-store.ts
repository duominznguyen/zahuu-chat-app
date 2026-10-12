import { create } from "zustand";

interface JumpRequest {
  conversationId: string;
  messageId: string;
}

interface JumpState {
  pending: JumpRequest | null;
  requestJump: (request: JumpRequest) => void;
  clear: () => void;
}

// Màn chọn tin (tìm kiếm...) nằm ở màn khác, chồng lên màn chat — gửi yêu cầu
// qua store để màn chat (vẫn mounted phía dưới stack) tự cuộn tới, thay vì
// truyền qua params (chọn lại đúng tin cũ lần 2 sẽ không đổi params nên không
// kích hoạt lại).
export const useJumpStore = create<JumpState>((set) => ({
  pending: null,
  requestJump: (request) => set({ pending: request }),
  clear: () => set({ pending: null }),
}));
