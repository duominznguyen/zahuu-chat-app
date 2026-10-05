import type { ConversationMember } from "./conversations";
import type { PublicUser } from "./friends";

interface SystemMessageContent {
  event: string;
  actorId: string;
  targetId?: string;
  // Snapshot displayName của target NGAY LÚC tạo tin (xem conversations.service.ts
  // backend) — dùng làm fallback khi target không còn trong `members` (đã bị
  // xoá/đã rời khỏi nhóm, luôn đúng cho member_removed/member_left).
  targetName?: string;
  newName?: string;
  nickname?: string;
}

// Ưu tiên tra qua `members` TRƯỚC (có nickname, phản ánh tên MỚI NHẤT nếu đổi
// sau thời điểm tạo tin), rơi về snapshot `fallbackName` nhúng sẵn trong
// content khi target không còn là thành viên — không thì không còn cách nào
// khác để biết tên họ nữa (members chỉ chứa thành viên HIỆN TẠI).
function resolveName(
  userId: string,
  fallbackName: string,
  members: ConversationMember[],
): string {
  const member = members.find((m) => m.id === userId);
  return member ? (member.nickname ?? member.displayName) : fallbackName;
}

// Dịch tin SYSTEM (content JSON) sang tiếng Việt để hiện trong chat — có đủ
// `members` (kèm nickname) của conversation đang xem nên dịch RICHER hơn bản
// phía backend dùng cho preview trên conversation list (chỉ có displayName thuần,
// không có context nickname lẫn target đã rời nhóm).
export function systemMessageText(
  content: string,
  sender: PublicUser,
  members: ConversationMember[],
): string {
  const data = JSON.parse(content) as SystemMessageContent;
  const actorName = resolveName(sender.id, sender.displayName, members);
  const targetName = data.targetId
    ? resolveName(data.targetId, data.targetName ?? "một thành viên", members)
    : undefined;

  switch (data.event) {
    case "member_added":
      return `${actorName} đã thêm ${targetName} vào nhóm`;
    case "member_joined_via_link":
      return `${actorName} đã tham gia nhóm qua link mời`;
    case "member_left":
      return `${actorName} đã rời nhóm`;
    case "member_removed":
      return `${actorName} đã xoá ${targetName} khỏi nhóm`;
    case "role_promoted":
      return `${actorName} đã bổ nhiệm ${targetName} làm quản trị viên`;
    case "role_demoted":
      return `${actorName} đã gỡ quyền quản trị viên của ${targetName}`;
    case "name_changed":
      return `${actorName} đã đổi tên nhóm thành "${data.newName}"`;
    case "avatar_changed":
      return `${actorName} đã đổi ảnh đại diện nhóm`;
    case "background_changed":
      return `${actorName} đã đổi hình nền đoạn chat`;
    case "nickname_set":
      return `${actorName} đã đặt biệt danh cho ${targetName} là "${data.nickname}"`;
    default:
      return "";
  }
}
