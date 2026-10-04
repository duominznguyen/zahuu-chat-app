import { useNavigate, useParams } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function UserProfileModal() {
  const navigate = useNavigate();
  const { userId } = useParams();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hồ sơ người dùng</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Xem hồ sơ user {userId} — nội dung thật sẽ làm ở W5.
        </p>
      </DialogContent>
    </Dialog>
  );
}
