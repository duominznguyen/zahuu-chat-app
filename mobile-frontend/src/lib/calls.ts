import { apiClient } from "./api-client";
import { formatRelativeTime } from "./format-time";
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

export interface IncomingCallPayload {
  callId: string;
  conversationId: string;
  type: CallType;
  conversationType: "DIRECT" | "GROUP";
  startedBy: PublicUser;
}

export function startCall(conversationId: string, type: CallType) {
  return apiClient.post<CallSession>(`/conversations/${conversationId}/calls`, {
    type,
  });
}

export function joinCall(callId: string) {
  return apiClient.post<{
    livekitRoomName: string;
    livekitToken: string;
    livekitUrl: string;
  }>(`/calls/${callId}/join`);
}

export function declineCall(callId: string) {
  return apiClient.post<void>(`/calls/${callId}/decline`);
}

export function leaveCall(callId: string) {
  return apiClient.post<void>(`/calls/${callId}/leave`);
}

export function callTitle(call: CallSummary) {
  const kind = call.type === "VIDEO" ? "video" : "thoại";
  return call.status === "MISSED"
    ? `Cuộc gọi nhỡ ${kind}`
    : `Cuộc gọi ${kind}`;
}

// Cuộc gọi đã nghe hiện thời lượng; nhỡ/từ chối hiện thời điểm gọi.
export function callSubtitle(call: CallSummary) {
  if (call.status === "ENDED") {
    return formatCallDuration(call.startedAt, call.endedAt);
  }
  return formatCallTime(call.startedAt);
}

// AM/PM để phân biệt nhanh với thời lượng (m:ss) của cuộc gọi đã nghe.
function formatCallTime(iso: string) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay ? time : `${formatRelativeTime(iso)} ${time}`;
}

export function formatCallDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "0:00";
  const seconds = Math.max(
    0,
    Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    ),
  );
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}
