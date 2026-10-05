import { create } from "zustand";
import type { CallType, IncomingCallPayload } from "@/lib/calls";

export interface ActiveCall {
  callId: string;
  conversationId: string;
  type: CallType;
  livekitRoomName: string;
  livekitToken: string;
  livekitUrl: string;
  // false khi đang đổ chuông chờ người kia bắt máy (phía người gọi).
  answered: boolean;
}

interface CallState {
  active: ActiveCall | null;
  incoming: IncomingCallPayload | null;
  setActive: (call: ActiveCall) => void;
  markAnswered: () => void;
  clearActive: () => void;
  setIncoming: (call: IncomingCallPayload) => void;
  clearIncoming: () => void;
}

// Tách khỏi route: cuộc gọi phải sống khi người dùng chuyển sang màn/tab khác.
export const useCallStore = create<CallState>((set) => ({
  active: null,
  incoming: null,
  setActive: (call) => set({ active: call }),
  markAnswered: () =>
    set((s) => (s.active ? { active: { ...s.active, answered: true } } : s)),
  clearActive: () => set({ active: null }),
  setIncoming: (call) => set({ incoming: call }),
  clearIncoming: () => set({ incoming: null }),
}));
