import { useParams } from "react-router-dom";

// Bản "độc lập" của /u/:userId — hiện khi mở thẳng URL này (vd dán link, mở
// tab mới) nên không có "route nền" để đè modal lên, xem mục "Modal route"
// web-frontend-plan.md.
export default function UserProfileStandalone() {
  const { userId } = useParams();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-foreground">Hồ sơ người dùng</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Xem hồ sơ user {userId} — nội dung thật sẽ làm ở W5.
        </p>
      </div>
    </div>
  );
}
