import type { SeenBy } from "@/lib/conversations";
import { UserAvatar } from "@/components/user-avatar";

interface SeenByRowProps {
  seenBy: SeenBy;
}

// Backend đã cắt `users` còn tối đa 5 — ở đây chỉ cần hiện phần dư còn lại thành "+N".
export function SeenByRow({ seenBy }: SeenByRowProps) {
  const hiddenCount = seenBy.count - seenBy.users.length;
  const names = seenBy.users.map((u) => u.displayName).join(", ");

  return (
    <div className="mt-0.5 mb-3 flex items-center justify-end" aria-label={`Đã xem bởi ${names}`}>
      {seenBy.users.map((user, index) => (
        <span
          key={user.id}
          title={user.displayName}
          className={`rounded-full ring-2 ring-background ${index > 0 ? "-ml-1" : ""}`}
        >
          <UserAvatar name={user.displayName} src={user.avatarUrl} size="xs" />
        </span>
      ))}
      {hiddenCount > 0 && <span className="ml-1 text-xs text-muted-foreground">+{hiddenCount}</span>}
    </div>
  );
}
