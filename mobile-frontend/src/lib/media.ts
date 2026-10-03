import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { useAuthStore } from "@/store/auth-store";
import { env } from "./env";

export type MediaPurpose =
  "AVATAR" | "COVER" | "GROUP_AVATAR" | "BACKGROUND" | "MESSAGE";

export interface UploadedMedia {
  url: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  bytes: number;
  originalName: string;
}

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

// Dùng XMLHttpRequest thay vì apiClient (fetch) vì fetch không có progress
// event cho phần upload — ChatInput cần hiện % để người dùng biết file lớn
// đang gửi, không phải app bị treo.
export function uploadMedia(
  file: PickedFile,
  purpose: MediaPurpose,
  onProgress?: (percent: number) => void,
): Promise<UploadedMedia> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("purpose", purpose);
    // React Native's FormData chấp nhận object {uri, name, type} làm file field.
    formData.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${env.apiUrl}/media/upload`);
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken)
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
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

// Tải file Cloudinary về máy rồi mở màn chia sẻ/lưu của hệ điều hành — dùng
// chung cho nút tải ở MediaViewer và bấm vào tin nhắn FILE trong Conversation.
export async function downloadAndShare(url: string) {
  const file = await File.downloadFileAsync(url, Paths.cache, {
    idempotent: true,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
  return file;
}
