import { useParams } from "react-router-dom";
import { UserProfileContent } from "@/components/user-profile-content";

// Bản "độc lập" của /u/:userId — hiện khi mở thẳng URL này (vd dán link, mở
// tab mới) nên không có "route nền" để đè modal lên, xem mục "Modal route"
// web-frontend-plan.md.
export default function UserProfileStandalone() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border">
        {userId && <UserProfileContent userId={userId} />}
      </div>
    </div>
  );
}
