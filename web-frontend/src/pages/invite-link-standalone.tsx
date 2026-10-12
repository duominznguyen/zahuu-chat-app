import { useParams } from "react-router-dom";
import { InviteLinkContent } from "@/components/invite-link-content";
import { StandalonePageShell } from "@/components/standalone-page-shell";

export default function InviteLinkStandalone() {
  const { conversationId } = useParams<{ conversationId: string }>();

  if (!conversationId) return null;

  return (
    <StandalonePageShell title="Link mời">
      <InviteLinkContent conversationId={conversationId} />
    </StandalonePageShell>
  );
}
