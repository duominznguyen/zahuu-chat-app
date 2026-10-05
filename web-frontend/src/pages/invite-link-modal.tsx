import { useNavigate, useParams } from "react-router-dom";
import { InviteLinkContent } from "@/components/invite-link-content";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function InviteLinkModal() {
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
          <DialogTitle>Link mời</DialogTitle>
        </DialogHeader>
        <div className="h-112">
          {conversationId && <InviteLinkContent conversationId={conversationId} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
