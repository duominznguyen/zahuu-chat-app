import { useNavigate } from "react-router-dom";
import { CreateGroupContent } from "@/components/create-group-content";
import { StandalonePageShell } from "@/components/standalone-page-shell";

export default function CreateGroupStandalone() {
  const navigate = useNavigate();

  return (
    <StandalonePageShell title="Tạo nhóm">
      <CreateGroupContent onCreated={(id) => navigate(`/chat/${id}`, { replace: true })} />
    </StandalonePageShell>
  );
}
