import { useNavigate, useParams } from "react-router-dom";
import { AddMembersContent } from "@/components/add-members-content";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AddMembersModal() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm thành viên</DialogTitle>
        </DialogHeader>
        <div className="h-112">
          {conversationId && (
            <AddMembersContent conversationId={conversationId} onDone={() => navigate(-1)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
