import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/error-state";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { changeUsername, errorCode, syncAuthUser, useMe, type MeProfile } from "@/lib/users";

const USERNAME_REGEX = /^[a-z0-9_.]{3,30}$/;

export default function SettingsUsername() {
  const meQuery = useMe();

  if (meQuery.isError) return <ErrorState onRetry={() => meQuery.refetch()} />;
  if (!meQuery.data) return null;
  return <UsernameForm me={meQuery.data} />;
}

function UsernameForm({ me }: { me: MeProfile }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  // Chốt 1 mốc thời gian lúc mở màn để tính cooldown ổn định khi render lại, không gọi Date.now() trong render.
  const [nowMs] = useState(() => Date.now());

  const normalized = username.trim().toLowerCase();
  const cooldownUntil = me.usernameChangeAvailableAt ? new Date(me.usernameChangeAvailableAt) : null;
  const inCooldown = !!cooldownUntil && cooldownUntil.getTime() > nowMs;

  const mutation = useMutation({
    mutationFn: () => changeUsername(normalized),
    onSuccess: (updated) => {
      queryClient.setQueryData(["users", "me"], updated);
      syncAuthUser(updated);
      setUsername("");
      toast.success("Đã đổi username");
    },
  });

  const taken = errorCode(mutation.error) === "USERNAME_TAKEN";
  const formatInvalid = normalized.length > 0 && !USERNAME_REGEX.test(normalized);
  const canSubmit =
    !inCooldown &&
    USERNAME_REGEX.test(normalized) &&
    normalized !== me.username &&
    !mutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Đổi username</h1>
      <p className="text-muted-foreground">Username hiện tại: @{me.username}</p>

      {inCooldown ? (
        <p className="text-sm text-warning">
          Bạn vừa đổi username gần đây, có thể đổi tiếp từ {cooldownUntil?.toLocaleDateString("vi-VN")}.
        </p>
      ) : (
        <>
          <FormField
            label="Username mới"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            placeholder="username"
            error={
              taken
                ? "Username đã được sử dụng"
                : formatInvalid
                  ? "Username không hợp lệ"
                  : undefined
            }
          />
          <p className="text-xs text-muted-foreground">
            3-30 ký tự, chỉ gồm chữ thường, số, dấu chấm và gạch dưới.
          </p>
          <div>
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()}>
              Lưu
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
