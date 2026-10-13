import { env } from "./env";

const webBase = env.webUrl.replace(/\/+$/, "");

// Cùng dạng URL với link web tạo ra — dán ra ngoài app (Messenger, email...)
// vẫn mở được bằng trình duyệt trên máy không cài app.
export function inviteUrl(token: string) {
  return `${webBase}/invite/${token}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// So chuỗi thay vì dùng `URL`: bản `URL` của React Native tự tách bằng regex,
// không chuẩn hoá như trình duyệt nên kết quả có thể lệch giữa web và máy thật.
const INVITE_PATTERNS = [
  new RegExp(`^${escapeRegExp(webBase)}/invite/([A-Za-z0-9_-]+)/?$`, "i"),
  // Dạng cũ trước khi đổi sang link web — vẫn còn trong lịch sử chat.
  /^zahuu:\/\/invite\/([A-Za-z0-9_-]+)\/?$/,
];

// Token mời nếu url là link mời của chính app. Link /invite/ của domain khác
// trả null để vẫn mở bằng trình duyệt như link thường.
export function parseInviteToken(url: string): string | null {
  for (const pattern of INVITE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
