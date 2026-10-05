import { env } from "./env";

export type MediaPurpose = "AVATAR" | "COVER" | "GROUP_AVATAR" | "BACKGROUND" | "MESSAGE";

export interface UploadedMedia {
  url: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  bytes: number;
  originalName: string;
}

// Dùng XMLHttpRequest thay vì fetch (apiClient) vì fetch không có progress
// event cho phần upload — cần hiện % lúc gửi file lớn.
export function uploadMedia(
  file: File,
  purpose: MediaPurpose,
  onProgress?: (percent: number) => void,
): Promise<UploadedMedia> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("purpose", purpose);
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${env.apiUrl}/media/upload`);
    xhr.withCredentials = true; // cookie accessToken tự gửi kèm, không có token nào để tự gắn header

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Phản hồi từ máy chủ không hợp lệ"));
        }
        return;
      }
      let message = "Tải lên thất bại";
      try {
        message = JSON.parse(xhr.responseText)?.message ?? message;
      } catch {
        // giữ message mặc định
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Không kết nối được máy chủ"));
    xhr.send(formData);
  });
}

export function messageTypeForFile(file: File): "IMAGE" | "VIDEO" | "FILE" {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  return "FILE";
}

// File picker trên web gộp chung 1 ô chọn (khác mobile tách ActionSheet
// "Ảnh/Video"/"File" vì OS picker riêng biệt) — type suy ra từ MIME ngay tại
// đây chỉ để UI biết gọi field nào, backend vẫn tự kiểm tra lại bằng magic
// bytes như mọi nơi khác, không tin content-type client gửi.
export const ACCEPTED_MEDIA_TYPES =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip";

// Cloudinary là domain khác origin -> thuộc tính `download` của <a> không
// được trình duyệt đảm bảo tôn trọng (chỉ chắc chắn hoạt động same-origin),
// nhưng vẫn là cách đơn giản nhất không cần tự fetch blob — tệ nhất thì mở
// tab mới thay vì tải thẳng, người dùng vẫn lưu được bằng tay.
export function downloadFile(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
