import { env } from "./env";

let refreshPromise: Promise<boolean> | null = null;

async function callRefreshEndpoint(): Promise<boolean> {
  const res = await fetch(`${env.apiUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  return res.ok;
}

// Dùng chung cho timer định kỳ (startRefreshTimer) lẫn nhánh phản ứng 401 ở
// api-client.ts. Khoá cross-tab qua Web Locks API — nhiều tab cùng browser
// share 1 cookie, nếu không khoá, 2 tab refresh gần đồng thời sẽ cùng gửi 1
// refresh token CŨ lên, bị backend hiểu nhầm là token bị tái sử dụng (rotation
// reuse detection) → revoke toàn bộ token, tự logout MỌI tab (xem CLAUDE.md
// mục Auth). 1 Promise dùng chung trong CÙNG tab cho nhiều lệnh gọi cùng lúc.
export function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const result = await navigator.locks.request(
      "auth-refresh",
      { ifAvailable: true },
      async (lock) => {
        if (!lock) return null; // tab khác đang giữ lock, đang tự refresh rồi
        return callRefreshEndpoint();
      },
    );
    if (result !== null) return result; // mình tự refresh, biết luôn kết quả thật

    // Không giành được lock ngay — đợi tới khi tab đang giữ nó xong (lock nhả
    // ra) rồi coi như thành công, KHÔNG tự refresh lại lần nữa (tránh đúng race
    // ở trên). Nếu tab đó thực ra thất bại, request tiếp theo sẽ lại 401 và tự
    // kích hoạt 1 lượt refreshSession() mới — tự phục hồi được.
    await navigator.locks.request("auth-refresh", async () => {});
    return true;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

const REFRESH_INTERVAL_MS = 12 * 60 * 1000; // ngắn hơn hạn 15 phút của access token
let refreshTimer: ReturnType<typeof setInterval> | null = null;

// Gọi lúc bootstrap/login thành công — giữ cookie accessToken luôn còn hạn,
// không đợi tới lúc 1 request REST bị 401 mới refresh (socket.io tự reconnect
// không tự báo 401 theo cách REST làm, xem auth-cookie-migration.md mục 10).
export function startRefreshTimer() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => void refreshSession(), REFRESH_INTERVAL_MS);
}

export function stopRefreshTimer() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}
