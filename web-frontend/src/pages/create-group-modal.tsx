import { useNavigate } from "react-router-dom";
import { CreateGroupContent } from "@/components/create-group-content";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CreateGroupModal() {
  const navigate = useNavigate();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo nhóm</DialogTitle>
        </DialogHeader>
        <div className="h-112">
          <CreateGroupContent onCreated={(id) => navigate(`/chat/${id}`, { replace: true })} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
