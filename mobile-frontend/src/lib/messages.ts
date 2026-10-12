import { apiClient } from "./api-client";
import type { CallSummary } from "./calls";
import type { PublicUser } from "./friends";

export type MessageType =
  "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "STICKER" | "SYSTEM" | "CALL";
export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";

export interface ReplyToPreview {
  id: string;
  senderId: string;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaName: string | null;
  isRecalled: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: PublicUser;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaPublicId: string | null;
  mediaName: string | null;
  mediaSize: number | null;
  replyTo: ReplyToPreview | null;
  call: CallSummary | null;
  isRecalled: boolean;
  recalledAt: string | null;
  createdAt: string;
  reactions: { userId: string; reactionType: ReactionType }[];
}

export interface MessagesPage {
  items: Message[];
  nextCursor: string | null;
  // Chỉ có ở trang lấy theo `after`/`around`: true khi vẫn còn tin mới hơn
  // trang này (chưa chạm tin mới nhất của đoạn chat).
  hasNewer?: boolean;
}

export function listMessages(conversationId: string, cursor?: string) {
  const qs = cursor ? `?cursor=${cursor}` : "";
  return apiClient.get<MessagesPage>(
    `/conversations/${conversationId}/messages${qs}`,
  );
}

// Trang tin MỚI HƠN 1 tin — tải tiếp về phía tin mới sau khi nhảy tới tin cũ.
export function listMessagesAfter(conversationId: string, afterId: string) {
  return apiClient.get<MessagesPage & { hasNewer: boolean }>(
    `/conversations/${conversationId}/messages?after=${afterId}`,
  );
}

export function sendTextMessage(
  conversationId: string,
  content: string,
  replyToId?: string,
) {
  return apiClient.post<Message>(`/conversations/${conversationId}/messages`, {
    type: "TEXT",
    content,
    replyToId,
  });
}

interface SendMediaOptions {
  mediaName?: string;
  mediaSize?: number;
  replyToId?: string;
}

export function sendMediaMessage(
  conversationId: string,
  type: "IMAGE" | "VIDEO" | "FILE",
  mediaUrl: string,
  mediaPublicId: string,
  options?: SendMediaOptions,
) {
  return apiClient.post<Message>(`/conversations/${conversationId}/messages`, {
    type,
    mediaUrl,
    mediaPublicId,
    mediaName: options?.mediaName,
    mediaSize: options?.mediaSize,
    replyToId: options?.replyToId,
  });
}

export function recallMessage(messageId: string) {
  return apiClient.patch(`/messages/${messageId}/recall`);
}

export function deleteMessageForMe(messageId: string) {
  return apiClient.delete(`/messages/${messageId}`);
}

export function setReaction(messageId: string, reactionType: ReactionType) {
  return apiClient.put(`/messages/${messageId}/reactions`, { reactionType });
}

export function removeReaction(messageId: string) {
  return apiClient.delete(`/messages/${messageId}/reactions`);
}

export function markRead(conversationId: string, lastReadMessageId: string) {
  return apiClient.patch(`/conversations/${conversationId}/read`, {
    lastReadMessageId,
  });
}

export interface SearchHit {
  id: string;
  content: string | null;
  createdAt: string;
  sender: PublicUser;
}

export interface SearchPage {
  items: SearchHit[];
  nextCursor: string | null;
}

// Chỉ tin TEXT chưa thu hồi, chưa xoá-cho-mình (lọc ở backend).
export function searchMessages(
  conversationId: string,
  q: string,
  cursor?: string,
) {
  const params = new URLSearchParams({ q });
  if (cursor) params.set("cursor", cursor);
  return apiClient.get<SearchPage>(
    `/conversations/${conversationId}/messages/search?${params}`,
  );
}

// MEDIA = ảnh + video, FILE = file đính kèm.
export function listMediaMessages(
  conversationId: string,
  kind: "MEDIA" | "FILE",
  cursor?: string,
) {
  const params = new URLSearchParams({ kind });
  if (cursor) params.set("cursor", cursor);
  return apiClient.get<MessagesPage>(
    `/conversations/${conversationId}/media?${params}`,
  );
}

export interface AroundPage extends MessagesPage {
  // true khi còn tin mới hơn cửa sổ này (cửa sổ không chạm tới tin mới nhất).
  hasNewer: boolean;
}

// Cửa sổ ~30 tin cũ + ~30 tin mới quanh 1 tin, 1 request — thời gian không phụ
// thuộc tin đó cách tin mới nhất bao xa.
export function getMessagesAround(conversationId: string, messageId: string) {
  return apiClient.get<AroundPage>(
    `/conversations/${conversationId}/messages/around?messageId=${messageId}`,
  );
}
