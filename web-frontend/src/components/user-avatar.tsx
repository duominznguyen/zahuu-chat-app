import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarProps {
  name: string;
  src?: string | null;
  online?: boolean;
  size?: "sm" | "default" | "lg";
}

export function UserAvatar({ name, src, online, size = "default" }: UserAvatarProps) {
  const initials = name.trim().slice(0, 1).toUpperCase();

  return (
    <Avatar size={size}>
      <AvatarImage src={src ?? undefined} alt={name} />
      <AvatarFallback>{initials}</AvatarFallback>
      {online && <AvatarBadge className="bg-success" />}
    </Avatar>
  );
}
