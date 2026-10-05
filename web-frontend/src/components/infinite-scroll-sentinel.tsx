import { useEffect, useRef } from "react";

interface InfiniteScrollSentinelProps {
  onVisible: () => void;
  enabled: boolean;
}

// Thay thế onEndReached của FlatList bên mobile — 1 phần tử rỗng cuối danh
// sách, tự gọi onVisible() khi cuộn tới gần nó.
export function InfiniteScrollSentinel({ onVisible, enabled }: InfiniteScrollSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Giữ callback mới nhất qua ref thay vì đưa thẳng vào dependency array —
  // onVisible thường là arrow function tạo mới mỗi render ở nơi gọi, đưa vào
  // dependency sẽ tái tạo observer liên tục, và vì phần tử đang intersect sẵn
  // (danh sách ngắn hơn viewport) observer mới luôn tự bắn callback ngay lúc
  // observe() dù vị trí cuộn không đổi — gây gọi fetchNextPage() lặp vô hạn.
  const onVisibleRef = useRef(onVisible);
  useEffect(() => {
    onVisibleRef.current = onVisible;
  });

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onVisibleRef.current();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return <div ref={ref} className="h-1" />;
}
