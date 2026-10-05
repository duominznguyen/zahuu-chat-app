import { apiClient } from "./api-client";

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FriendItem {
  friendshipId: string;
  since: string;
  user: PublicUser;
}

export interface FriendsPage {
  items: FriendItem[];
  nextCursor: string | null;
}

export function listFriends(cursor?: string) {
  const qs = cursor ? `?cursor=${cursor}` : "";
  return apiClient.get<FriendsPage>(`/friends${qs}`);
}

export function searchFriendsByName(q: string) {
  return apiClient.get<PublicUser[]>(`/friends/search?q=${encodeURIComponent(q)}`);
}

export function unfriend(userId: string) {
  return apiClient.delete(`/friends/${userId}`);
}

export interface FriendRequestItem {
  id: string;
  createdAt: string;
  user: PublicUser;
}

export function listFriendRequests(type: "received" | "sent") {
  return apiClient.get<FriendRequestItem[]>(`/friend-requests?type=${type}`);
}

export function sendFriendRequest(receiverId: string) {
  return apiClient.post<{ status: "pending" | "accepted"; requestId?: string }>(
    "/friend-requests",
    { receiverId },
  );
}

export function respondFriendRequest(id: string, action: "accept" | "reject") {
  return apiClient.patch<{ status: "accepted" | "rejected" }>(`/friend-requests/${id}`, {
    action,
  });
}

export function cancelFriendRequest(id: string) {
  return apiClient.delete(`/friend-requests/${id}`);
}

export function searchUsersByUsername(q: string) {
  return apiClient.get<PublicUser[]>(`/users/search?q=${encodeURIComponent(q)}`);
}

export interface BlockedUser extends PublicUser {
  blockedAt: string;
}

export function listBlocked() {
  return apiClient.get<BlockedUser[]>("/blocks");
}

export function blockUser(userId: string) {
  return apiClient.post("/blocks", { userId });
}

export function unblockUser(userId: string) {
  return apiClient.delete(`/blocks/${userId}`);
}

export type RelationshipStatus =
  | "self"
  | "none"
  | "pending_sent"
  | "pending_received"
  | "friends"
  | "blocked";

export interface UserProfile extends PublicUser {
  coverUrl: string | null;
  bio: string | null;
  birthday?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  relationshipStatus: RelationshipStatus;
}

export function getUserProfile(userId: string) {
  return apiClient.get<UserProfile>(`/users/${userId}`);
}
