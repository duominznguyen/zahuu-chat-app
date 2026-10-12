import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/media";

const MAX_SCALE = 4;

// Không cần pinch-zoom (gesture cảm ứng) như mobile — cuộn chuột để zoom, kéo
// chuột để pan khi đã zoom, double-click để toggle zoom nhanh (tương đương
// double-tap mobile).
function ZoomableImage({ url }: { url: string }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Phải đăng ký non-passive để preventDefault() được — thiếu bước này,
    // trang nền sẽ tự cuộn theo cùng lúc với zoom.
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        const next = Math.max(1, Math.min(MAX_SCALE, s - e.deltaY * 0.01));
        if (next <= 1) setTranslate({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const handleMouseDown = (e: MouseEvent) => {
    if (scale <= 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: translate.x, origY: translate.y };
  };
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragRef.current) return;
    setTranslate({
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
    });
  };
  const handleMouseUp = () => {
    dragRef.current = null;
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <img
        src={url}
        alt=""
        draggable={false}
        className="max-h-full max-w-full select-none"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          cursor: scale > 1 ? "grab" : "default",
        }}
      />
    </div>
  );
}

export interface MediaViewerItem {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
}

interface MediaViewerProps {
  items: MediaViewerItem[];
  currentId: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export function MediaViewer({ items, currentId, onClose, onNavigate }: MediaViewerProps) {
  const index = items.findIndex((i) => i.id === currentId);
  const current = items[index];
  // Mảng items mới nhất trước (quy ước chung toàn app) — index giảm = tin CŨ
  // hơn (trái/Prev), index tăng = tin MỚI hơn (phải/Next).
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < items.length - 1;

  useEffect(() => {
    // capture: true để chạy TRƯỚC hành vi bắt phím mũi tên mặc định của thẻ
    // <video> (seek) — thiếu bước này, 1 lần bấm mũi tên vừa seek video vừa
    // nhảy sang ảnh/video kế tiếp cùng lúc.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        onNavigate(items[index - 1].id);
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onNavigate(items[index + 1].id);
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [index, items, hasPrev, hasNext, onClose, onNavigate]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={onClose}>
      <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between p-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Đóng"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tải về"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            downloadFile(current.url);
          }}
        >
          <Download />
        </Button>
      </div>

      {hasPrev && (
        <button
          type="button"
          aria-label="Trước"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(items[index - 1].id);
          }}
          className="absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <ChevronLeft />
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          aria-label="Kế tiếp"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(items[index + 1].id);
          }}
          className="absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <ChevronRight />
        </button>
      )}

      <div className="h-full w-full p-12" onClick={(e) => e.stopPropagation()}>
        {current.type === "VIDEO" ? (
          <video key={current.url} src={current.url} controls autoPlay tabIndex={-1} className="h-full w-full object-contain" />
        ) : (
          <ZoomableImage key={current.url} url={current.url} />
        )}
      </div>
    </div>
  );
}
