import { AtSign, Ban, KeyRound, SunMoon, UserRound, UserX, X } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useMe } from "@/lib/users";

function SettingsNavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-accent font-medium text-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export default function SettingsLayout() {
  const navigate = useNavigate();
  const meQuery = useMe();
  const hasPassword = meQuery.data?.hasPassword ?? true;

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col gap-1 border-r border-border p-4">
        <p className="px-3 pb-3 pt-1 text-lg font-semibold text-foreground">Cài đặt</p>
        <SettingsNavLink to="profile" icon={<UserRound className="size-4" />} label="Hồ sơ" />
        <SettingsNavLink to="username" icon={<AtSign className="size-4" />} label="Đổi username" />
        <SettingsNavLink
          to="password"
          icon={<KeyRound className="size-4" />}
          label={hasPassword ? "Đổi mật khẩu" : "Đặt mật khẩu"}
        />
        <SettingsNavLink to="blocked" icon={<Ban className="size-4" />} label="Danh sách chặn" />
        <SettingsNavLink to="appearance" icon={<SunMoon className="size-4" />} label="Giao diện" />
        <SettingsNavLink to="deactivate" icon={<UserX className="size-4" />} label="Vô hiệu hoá tài khoản" />
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        <button
          type="button"
          aria-label="Đóng cài đặt"
          onClick={() => navigate("/chat")}
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-5" />
        </button>
        <div className="mx-auto max-w-2xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
