import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function ChatEmpty() {
  return (
    <EmptyState
      icon={<MessageCircle className="size-10" />}
      title="Chọn 1 cuộc trò chuyện để bắt đầu"
    />
  );
}
