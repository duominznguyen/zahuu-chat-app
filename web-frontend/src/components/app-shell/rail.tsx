import { LogOut, MessageCircle, Settings, Users } from "lucide-react";
import { useEffect } from "react";
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
import { getLastTabPath, setLastTabPath, type RailTab } from "@/lib/last-tab-path";
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

function currentTab(pathname: string): RailTab | null {
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/friends")) return "friends";
  return null;
}

export function Rail() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const activeTab = currentTab(location.pathname);

  // Chuyển tab rồi quay lại phải mở lại đúng đoạn chat/hồ sơ đang xem, không
  // về trang trống. Chỉ nhớ pathname: ?tab=requests là lệnh mở tab Lời mời
  // một lần, nhớ lại sẽ ép về tab đó dù người dùng đã chuyển sang tab khác.
  useEffect(() => {
    if (activeTab) setLastTabPath(activeTab, location.pathname);
  }, [activeTab, location.pathname]);

  const tabTarget = (tab: RailTab) => (tab === activeTab ? location.pathname : getLastTabPath(tab));

  // Tự về /login không kèm ?redirect — để ProtectedRoute tự đá thì đích là
  // trang đang mở (vd đoạn chat), tài khoản đăng nhập/đăng ký kế tiếp sẽ bị
  // đưa vào đoạn chat của tài khoản cũ và nhận 404.
  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const initials =(user?.displayName ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <nav className="flex h-screen w-16 flex-col items-center justify-between border-r border-border bg-background py-4">
      <div className="flex flex-col items-center gap-2">
        <RailLink
          to={tabTarget("chat")}
          icon={<MessageCircle className="size-5" />}
          label="Tin nhắn"
          active={activeTab === "chat"}
        />
        <RailLink
          to={tabTarget("friends")}
          icon={<Users className="size-5" />}
          label="Bạn bè"
          active={activeTab === "friends"}
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
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut />
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
