import { useNavigate, useParams } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserProfileContent } from "@/components/user-profile-content";

export default function UserProfileModal() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
    >
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hồ sơ người dùng</DialogTitle>
        </DialogHeader>
        {userId && <UserProfileContent userId={userId} />}
      </DialogContent>
    </Dialog>
  );
}
