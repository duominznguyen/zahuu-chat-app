import { apiClient } from "./api-client";
import type { PublicUser } from "./friends";

export type ConversationType = "DIRECT" | "GROUP";
export type MemberRole = "ADMIN" | "MEMBER";

export interface MessagePreview {
  id: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "STICKER";
  content: string | null;
  isRecalled: boolean;
  senderId: string;
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  name: string | null;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  lastMessageAt: string | null;
  lastMessage: MessagePreview | null;
  unread: boolean;
  role: MemberRole | null;
  memberCount?: number;
  otherUser?: { id: string; username: string; isOnline: boolean } | null;
}

export interface ConversationsPage {
  items: ConversationSummary[];
  nextCursor: string | null;
}

export function listConversations(cursor?: string) {
  const qs = cursor ? `?cursor=${cursor}` : "";
  return apiClient.get<ConversationsPage>(`/conversations${qs}`);
}

export interface ConversationMember extends PublicUser {
  nickname: string | null;
  role: MemberRole;
  joinedAt: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  isOnline: boolean;
}

// Group management fields (PATCH/leave/members/invite-links...) chưa cần ở
// đây — thêm vào khi làm W8.
export interface ConversationDetail {
  id: string;
  type: ConversationType;
  name: string | null;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  role: MemberRole | null;
  members: ConversationMember[];
}

export function getConversationDetail(id: string) {
  return apiClient.get<ConversationDetail>(`/conversations/${id}`);
}

export function createDirectConversation(friendId: string) {
  return apiClient.post<ConversationDetail>("/conversations/direct", { friendId });
}
