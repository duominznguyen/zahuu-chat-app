import { useParams } from "react-router-dom";
import { EmptyState } from "@/components/empty-state";

export default function FriendProfilePlaceholder() {
  const { userId } = useParams();

  return <EmptyState title={`Hồ sơ bạn bè ${userId}`} description="Nội dung thật sẽ làm ở W5" />;
}
