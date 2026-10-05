import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/error-state";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadMedia } from "@/lib/media";
import {
  syncAuthUser,
  updateProfile,
  useMe,
  type Gender,
  type MeProfile,
} from "@/lib/users";
import { cn } from "@/lib/utils";

const GENDER_LABEL: Record<Gender, string> = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác" };
const GENDER_OPTIONS: Gender[] = ["MALE", "FEMALE", "OTHER"];

function todayLocalIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function SettingsProfile() {
  const meQuery = useMe();

  if (meQuery.isError) return <ErrorState onRetry={() => meQuery.refetch()} />;
  if (!meQuery.data) return null;
  return <ProfileForm me={meQuery.data} />;
}

function ProfileForm({ me }: { me: MeProfile }) {
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(me.displayName);
  const [bio, setBio] = useState(me.bio ?? "");
  const [birthday, setBirthday] = useState(me.birthday?.slice(0, 10) ?? "");
  const [gender, setGender] = useState<Gender | null>(me.gender);
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(me.coverUrl);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);

  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const today = todayLocalIso();

  // Thả file ra ngoài vùng ảnh sẽ khiến trình duyệt mở file thay cho trang —
  // chặn ở cấp window để không mất nội dung đang chỉnh sửa.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  const uploadImage = async (file: File, purpose: "AVATAR" | "COVER") => {
    if (!file.type.startsWith("image/")) {
      toast.error("Chỉ chấp nhận file ảnh");
      return;
    }
    const setBusy = purpose === "AVATAR" ? setAvatarBusy : setCoverBusy;
    const setUrl = purpose === "AVATAR" ? setAvatarUrl : setCoverUrl;
    setBusy(true);
    try {
      const uploaded = await uploadMedia(file, purpose);
      setUrl(uploaded.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh lên thất bại");
    } finally {
      setBusy(false);
    }
  };

  const birthdayError = birthday && birthday > today ? "Ngày sinh không hợp lệ" : undefined;

  const saveMutation = useMutation({
    mutationFn: () =>
      updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        birthday: birthday || null,
        gender,
        avatarUrl,
        coverUrl,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["users", "me"], updated);
      syncAuthUser(updated);
      toast.success("Đã lưu hồ sơ");
    },
    onError: () => toast.error("Lưu hồ sơ thất bại, vui lòng thử lại"),
  });

  const canSave =
    !birthdayError && displayName.trim().length > 0 && !saveMutation.isPending && !avatarBusy && !coverBusy;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Hồ sơ</h1>

      <DropImageArea
        label="Đổi ảnh bìa"
        className="h-32 w-full rounded-xl"
        busy={coverBusy}
        inputRef={coverInput}
        onFile={(file) => uploadImage(file, "COVER")}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" />
        )}
      </DropImageArea>

      <div className="-mt-14 ml-6 w-fit">
        <DropImageArea
          label="Đổi ảnh đại diện"
          className="size-24 rounded-full ring-4 ring-background"
          busy={avatarBusy}
          inputRef={avatarInput}
          onFile={(file) => uploadImage(file, "AVATAR")}
        >
          <Avatar className="size-full">
            <AvatarImage src={avatarUrl ?? undefined} alt="" />
            <AvatarFallback>{displayName.trim().slice(0, 1).toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
        </DropImageArea>
      </div>

      <FormField
        label="Tên hiển thị"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={50}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-bio">Giới thiệu</Label>
        <Textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={255}
          rows={3}
        />
      </div>

      <FormField
        label="Ngày sinh"
        type="date"
        max={today}
        value={birthday}
        onChange={(e) => setBirthday(e.target.value)}
        error={birthdayError}
      />

      <div className="flex flex-col gap-1.5">
        <Label>Giới tính</Label>
        <div className="flex gap-2">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={gender === g}
              onClick={() => setGender(gender === g ? null : g)}
              className={cn(
                "flex-1 rounded-xl border py-2 text-sm font-medium transition-colors",
                gender === g
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {GENDER_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Button disabled={!canSave} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending && <Loader2 className="animate-spin" />}
          Lưu
        </Button>
      </div>
    </div>
  );
}

function DropImageArea({
  label,
  className,
  busy,
  inputRef,
  onFile,
  children,
}: {
  label: string;
  className: string;
  busy: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  children: React.ReactNode;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        disabled={busy}
        className={cn(
          "group relative flex items-center justify-center overflow-hidden bg-muted transition-colors",
          dragging && "ring-2 ring-primary",
          className,
        )}
      >
        {children}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white transition-opacity",
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : label}
        </span>
      </button>
    </>
  );
}
