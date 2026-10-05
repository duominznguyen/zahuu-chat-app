import { useParams } from "react-router-dom";
import { UserProfileContent } from "@/components/user-profile-content";

export default function FriendProfile() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <div className="h-full overflow-y-auto">{userId && <UserProfileContent userId={userId} />}</div>
  );
}
