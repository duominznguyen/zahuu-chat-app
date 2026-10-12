import { BellRing, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  enableWebPush,
  isPushConfigured,
  isPushPermissionDenied,
  isPushPermissionGranted,
  isPushSupported,
  syncWebPushTokenIfGranted,
} from "@/lib/web-push";

const DISMISSED_KEY = "web-push-prompt-dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Không lưu được thì chỉ ẩn trong phiên này, lần sau hiện lại — chấp nhận được.
  }
}

// Banner mở quyền thông báo — không tự prompt lúc đăng nhập vì trình duyệt sẽ chặn
// vĩnh viễn nếu người dùng từ chối một lần, nên chỉ hỏi khi họ chủ động bấm.
export function WebPushPrompt() {
  const [supported, setSupported] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(isPushPermissionDenied);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushConfigured) return;
    let cancelled = false;
    isPushSupported().then((ok) => {
      if (!cancelled) setSupported(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPushPermissionGranted()) return;
    syncWebPushTokenIfGranted().catch(() => {
      // Đăng ký lại lỗi (mạng...) không cần chặn app — lần mở sau sẽ thử lại.
    });
  }, []);

  if (!isPushConfigured || !supported || dismissed || isPushPermissionGranted()) return null;

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const result = await enableWebPush();
      if (result === "enabled") {
        toast.success("Đã bật thông báo");
        setDismissed(true);
      } else if (result === "denied") {
        setPermissionDenied(isPushPermissionDenied());
      } else {
        setSupported(false);
      }
    } catch {
      toast.error("Không bật được thông báo, vui lòng thử lại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-20 z-50 flex w-80 items-start gap-3 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-lg">
      <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex flex-1 flex-col gap-3">
        {permissionDenied ? (
          <p className="text-sm">
            Bạn đã chặn thông báo. Vào cài đặt trình duyệt để bật lại cho trang này.
          </p>
        ) : (
          <>
            <p className="text-sm">Bật thông báo để không bỏ lỡ tin nhắn và lời mời mới.</p>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={enable}>
                Bật thông báo
              </Button>
              <Button size="sm" variant="outline" onClick={dismiss}>
                Để sau
              </Button>
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        aria-label="Đóng"
        onClick={dismiss}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
