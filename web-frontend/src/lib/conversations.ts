import { apiClient } from "./api-client";

// Type đầy đủ (members, lastMessage...) sẽ bổ sung ở W6 khi làm Chat core —
// nơi gọi hiện tại (UserProfileContent) chỉ cần `id` để điều hướng.
export interface ConversationDetail {
  id: string;
  type: "DIRECT" | "GROUP";
  name: string | null;
  avatarUrl: string | null;
}

export function createDirectConversation(friendId: string) {
  return apiClient.post<ConversationDetail>("/conversations/direct", { friendId });
}
