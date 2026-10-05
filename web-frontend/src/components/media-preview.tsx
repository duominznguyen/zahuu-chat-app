import { Play } from "lucide-react";
import { useState } from "react";

const MEDIA_MAX_WIDTH = 220;
const MEDIA_MAX_HEIGHT = 280;

// Server chưa lưu width/height gốc nên phải đợi ảnh/video tải xong mới biết
// tỉ lệ thật — cache theo url ở module-level để tin cuộn ra/vào viewport
// không bị nháy về khung mặc định lần nữa.
const aspectRatioCache = new Map<string, number>();

// Chỉ giới hạn kích thước TỐI ĐA, giữ nguyên tỉ lệ thật — chấp nhận ảnh quá
// dài/quá ngang bị bẹp thay vì ép về khung vuông-ish.
function clampMediaSize(ratio: number) {
  let width = MEDIA_MAX_WIDTH;
  let height = width / ratio;
  if (height > MEDIA_MAX_HEIGHT) {
    height = MEDIA_MAX_HEIGHT;
    width = height * ratio;
  }
  return { width, height };
}

interface MediaPreviewProps {
  url: string;
  isVideo: boolean;
  onClick: () => void;
}

export function MediaPreview({ url, isVideo, onClick }: MediaPreviewProps) {
  const [ratio, setRatio] = useState<number | null>(() => aspectRatioCache.get(url) ?? null);

  const handleLoad = (width: number, height: number) => {
    if (!width || !height) return;
    const next = width / height;
    aspectRatioCache.set(url, next);
    setRatio(next);
  };

  const { width, height } = ratio ? clampMediaSize(ratio) : { width: MEDIA_MAX_WIDTH, height: MEDIA_MAX_WIDTH };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width, height }}
      className="relative overflow-hidden rounded-2xl bg-secondary"
    >
      {isVideo ? (
        <video
          src={url}
          className="size-full object-cover"
          preload="metadata"
          muted
          onLoadedMetadata={(e) => handleLoad(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
        />
      ) : (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          onLoad={(e) => handleLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
        />
      )}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="size-10 fill-white text-white" />
        </div>
      )}
    </button>
  );
}
