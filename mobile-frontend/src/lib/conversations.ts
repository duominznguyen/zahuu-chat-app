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
  return apiClient.post<ConversationDetail>("/conversations/direct", {
    friendId,
  });
}

export function createGroupConversation(name: string, memberIds: string[]) {
  return apiClient.post<ConversationDetail>("/conversations/group", {
    name,
    memberIds,
  });
}

export function updateConversation(
  id: string,
  data: { name?: string; avatarUrl?: string | null },
) {
  return apiClient.patch<ConversationDetail>(`/conversations/${id}`, data);
}

export function updateBackground(id: string, url: string | null) {
  return apiClient.patch<ConversationDetail>(
    `/conversations/${id}/background`,
    { url },
  );
}

export function leaveConversation(id: string) {
  return apiClient.delete(`/conversations/${id}/leave`);
}

export function disbandConversation(id: string) {
  return apiClient.delete(`/conversations/${id}`);
}

export function addMember(id: string, userId: string) {
  return apiClient.post<ConversationDetail>(`/conversations/${id}/members`, {
    userId,
  });
}

export function removeMember(id: string, userId: string) {
  return apiClient.delete(`/conversations/${id}/members/${userId}`);
}

export function updateMemberRole(id: string, userId: string, role: MemberRole) {
  return apiClient.patch(`/conversations/${id}/members/${userId}/role`, {
    role,
  });
}

export function setNickname(
  id: string,
  targetUserId: string,
  nickname: string,
) {
  return apiClient.put<{ targetUserId: string; nickname: string }>(
    `/conversations/${id}/nicknames/${targetUserId}`,
    { nickname },
  );
}

export interface InviteLink {
  id: string;
  token: string;
  createdAt: string;
}

export function createInviteLink(id: string) {
  return apiClient.post<InviteLink>(`/conversations/${id}/invite-links`);
}

export function listInviteLinks(id: string) {
  return apiClient.get<InviteLink[]>(`/conversations/${id}/invite-links`);
}

export function revokeInviteLink(id: string, linkId: string) {
  return apiClient.patch(`/conversations/${id}/invite-links/${linkId}/revoke`);
}

export function joinByInviteToken(token: string) {
  return apiClient.post<ConversationDetail>(`/invite-links/${token}/join`);
}

export interface InviteLinkPreview {
  conversationId: string;
  name: string;
  avatarUrl: string | null;
  memberCount: number;
  alreadyMember: boolean;
}

export function previewInviteLink(token: string) {
  return apiClient.get<InviteLinkPreview>(`/invite-links/${token}`);
}
