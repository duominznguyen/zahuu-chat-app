import { apiClient } from "./api-client";
import type { PublicUser } from "./friends";

export type CallType = "AUDIO" | "VIDEO";
export type CallStatus = "RINGING" | "ONGOING" | "ENDED" | "MISSED" | "DECLINED";

export interface CallSummary {
  id: string;
  type: CallType;
  status: CallStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface ActiveCallInfo {
  id: string;
  type: CallType;
  status: CallStatus;
  startedById: string;
}

export interface CallSession {
  callId: string;
  type: CallType;
  livekitRoomName: string;
  livekitToken: string;
  livekitUrl: string;
}

export function startCall(conversationId: string, type: CallType) {
  return apiClient.post<CallSession>(`/conversations/${conversationId}/calls`, { type });
}

export function joinCall(callId: string) {
  return apiClient.post<{ livekitRoomName: string; livekitToken: string; livekitUrl: string }>(
    `/calls/${callId}/join`,
  );
}

export function declineCall(callId: string) {
  return apiClient.post<void>(`/calls/${callId}/decline`);
}

export function leaveCall(callId: string) {
  return apiClient.post<void>(`/calls/${callId}/leave`);
}

export interface IncomingCallPayload {
  callId: string;
  conversationId: string;
  type: CallType;
  conversationType: "DIRECT" | "GROUP";
  startedBy: PublicUser;
}

export function callHistoryLabel(call: CallSummary) {
  const kind = call.type === "VIDEO" ? "video" : "thoại";
  switch (call.status) {
    case "ENDED":
      return `Cuộc gọi ${kind} · ${formatCallDuration(call.startedAt, call.endedAt)}`;
    case "MISSED":
      return "Cuộc gọi nhỡ";
    case "DECLINED":
      return "Đã từ chối cuộc gọi";
    default:
      return `Cuộc gọi ${kind}`;
  }
}

export function formatCallDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "0:00";
  const seconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}
