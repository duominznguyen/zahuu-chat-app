import { useLocation, useNavigate, useParams } from "react-router-dom";
import { GroupMembersContent } from "@/components/group-members-content";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { rootBackground } from "@/lib/background-location";

export default function GroupMembersModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId } = useParams<{ conversationId: string }>();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) navigate(-1);
      }}
    >
      <DialogContent className="flex h-128 flex-col p-0 sm:max-w-lg" showCloseButton={false}>
        {conversationId && (
          <GroupMembersContent
            conversationId={conversationId}
            onOpenAddMembers={() =>
              navigate(`/add-members/${conversationId}`, {
                state: { background: rootBackground(location) },
              })
            }
            onClose={() => navigate(-1)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
