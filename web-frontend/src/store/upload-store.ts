import { create } from "zustand";
import { toast } from "sonner";
import { messageTypeForFile, uploadMedia } from "@/lib/media";
import { sendMediaMessage } from "@/lib/messages";

interface UploadState {
  label: string;
  progress: number;
}

interface UploadStoreState {
  // Keyed theo conversationId, không phải state cục bộ của Conversation — web
  // giữ List Pane luôn hiện sẵn nên người dùng có thể bấm sang conversation
  // khác giữa lúc đang upload rồi quay lại; nếu state nằm trong component,
  // unmount Main Pane sẽ abort luôn XMLHttpRequest đang chạy dở.
  uploads: Record<string, UploadState>;
  startUpload: (conversationId: string, file: File, replyToId?: string) => void;
}

export const useUploadStore = create<UploadStoreState>((set) => ({
  uploads: {},
  startUpload: (conversationId, file, replyToId) => {
    const type = messageTypeForFile(file);
    set((s) => ({ uploads: { ...s.uploads, [conversationId]: { label: file.name, progress: 0 } } }));

    uploadMedia(file, "MESSAGE", (progress) => {
      set((s) => ({ uploads: { ...s.uploads, [conversationId]: { label: file.name, progress } } }));
    })
      .then((uploaded) =>
        sendMediaMessage(conversationId, type, uploaded.url, uploaded.publicId, {
          mediaName: type === "FILE" ? uploaded.originalName : undefined,
          mediaSize: type === "FILE" ? uploaded.bytes : undefined,
          replyToId,
        }),
      )
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Gửi thất bại, vui lòng thử lại");
      })
      .finally(() => {
        set((s) => {
          const next = { ...s.uploads };
          delete next[conversationId];
          return { uploads: next };
        });
      });
  },
}));
