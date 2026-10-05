import { useLocation, useNavigate, useParams } from "react-router-dom";
import { GroupMembersContent } from "@/components/group-members-content";
import { StandalonePageShell } from "@/components/standalone-page-shell";
import { rootBackground } from "@/lib/background-location";

export default function GroupMembersStandalone() {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId } = useParams<{ conversationId: string }>();

  if (!conversationId) return null;

  return (
    <StandalonePageShell title="Thành viên">
      <GroupMembersContent
        conversationId={conversationId}
        onOpenAddMembers={() =>
          navigate(`/add-members/${conversationId}`, {
            state: { background: rootBackground(location) },
          })
        }
      />
    </StandalonePageShell>
  );
}
