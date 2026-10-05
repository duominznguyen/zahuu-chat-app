import { useNavigate, useParams } from "react-router-dom";
import { AddMembersContent } from "@/components/add-members-content";
import { StandalonePageShell } from "@/components/standalone-page-shell";

export default function AddMembersStandalone() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();

  if (!conversationId) return null;

  return (
    <StandalonePageShell title="Thêm thành viên">
      <AddMembersContent
        conversationId={conversationId}
        onDone={() => navigate(`/chat/${conversationId}`)}
      />
    </StandalonePageShell>
  );
}
