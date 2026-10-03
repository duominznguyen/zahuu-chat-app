import { apiClient } from "./api-client";
import type { PublicUser } from "./friends";

export type NotificationType =
  "FRIEND_REQUEST_RECEIVED" | "FRIEND_REQUEST_ACCEPTED" | "GROUP_MEMBER_ADDED";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: PublicUser | null;
  conversationId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  nextCursor: string | null;
}

export function listNotifications(cursor?: string) {
  const qs = cursor ? `?cursor=${cursor}` : "";
  return apiClient.get<NotificationsPage>(`/notifications${qs}`);
}

export function markNotificationRead(id: string) {
  return apiClient.patch<void>(`/notifications/${id}/read`);
}
