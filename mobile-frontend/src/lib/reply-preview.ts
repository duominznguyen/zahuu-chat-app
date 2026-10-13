import type { MessageType } from "./messages";

interface ReplyPreviewData {
  type: MessageType;
  content: string | null;
  mediaName: string | null;
  isRecalled: boolean;
}

// Tin ảnh/video/file không có `content` (chỉ TEXT/STICKER mới dùng field này)
// — phải tự suy nhãn theo `type`, nếu không ô trích dẫn sẽ trống trơn.
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
