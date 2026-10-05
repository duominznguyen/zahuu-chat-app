import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function FriendsEmpty() {
  return (
    <EmptyState icon={<Users className="size-10" />} title="Chọn 1 người bạn để xem hồ sơ" />
  );
}
