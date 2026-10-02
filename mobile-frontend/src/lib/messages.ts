import { apiClient } from "./api-client";
import type { PublicUser } from "./friends";

export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "STICKER";
export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";

export interface ReplyToPreview {
  id: string;
  senderId: string;
  type: MessageType;
  content: string | null;
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
  isRecalled: boolean;
  recalledAt: string | null;
  createdAt: string;
  reactions: { userId: string; reactionType: ReactionType }[];
}

export interface MessagesPage {
  items: Message[];
  nextCursor: string | null;
}

export function listMessages(conversationId: string, cursor?: string) {
  const qs = cursor ? `?cursor=${cursor}` : "";
  return apiClient.get<MessagesPage>(
    `/conversations/${conversationId}/messages${qs}`,
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
