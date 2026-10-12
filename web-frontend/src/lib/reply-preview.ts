import type { MessageType } from "./messages";

interface ReplyPreviewData {
  type: MessageType;
  content: string | null;
  mediaName: string | null;
  isRecalled: boolean;
}

// Tin trả lời tới media (IMAGE/VIDEO/FILE) không có `content` (chỉ TEXT/STICKER
// mới dùng field này) — phải tự suy nhãn hiển thị theo `type`, nếu không ô
// preview sẽ trống trơn dù tin gốc rõ ràng có nội dung thật.
export function replyPreviewLabel(data: ReplyPreviewData): string {
  if (data.isRecalled) return "Tin nhắn đã thu hồi";
  switch (data.type) {
    case "IMAGE":
      return "Hình ảnh";
    case "VIDEO":
      return "Video";
    case "FILE":
      return data.mediaName ?? "File";
    case "STICKER":
      return data.content ?? "Nhãn dán";
    default:
      return data.content ?? "";
  }
}
