import { LogOut, MessageCircle, Settings, Users } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NotificationsBell } from "@/components/notifications-bell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/store/auth-store";
import { railItemClass } from "./rail-item-class";

function RailLink({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to={to} aria-label={label} className={railItemClass(active)}>
          {icon}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Rail() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const initials = (user?.displayName ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <nav className="flex h-screen w-16 flex-col items-center justify-between border-r border-border bg-background py-4">
      <div className="flex flex-col items-center gap-2">
        <RailLink
          to="/chat"
          icon={<MessageCircle className="size-5" />}
          label="Tin nhắn"
          active={location.pathname.startsWith("/chat")}
        />
        <RailLink
          to="/friends"
          icon={<Users className="size-5" />}
          label="Bạn bè"
          active={location.pathname.startsWith("/friends")}
        />

        <NotificationsBell />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label="Tài khoản" className="rounded-full outline-none">
            <Avatar>
              <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.displayName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end">
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <Settings />
            Cài đặt
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => logout()}>
            <LogOut />
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
