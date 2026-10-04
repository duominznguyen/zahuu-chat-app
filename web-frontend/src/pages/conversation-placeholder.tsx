import { useParams } from "react-router-dom";
import { EmptyState } from "@/components/empty-state";

export default function ConversationPlaceholder() {
  const { conversationId } = useParams();

  return (
    <EmptyState
      title={`Conversation ${conversationId}`}
      description="Nội dung chat thật sẽ làm ở W6"
    />
  );
}
