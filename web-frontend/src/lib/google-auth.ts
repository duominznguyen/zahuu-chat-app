import { env } from "./env";

// Khai type tối thiểu cho phần Google Identity Services thực tế dùng tới —
// không có gói @types chính thức phổ biến cho API này.
interface GoogleIdCredentialResponse {
  credential: string;
}

interface GoogleIdPromptNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    use_fedcm_for_prompt?: boolean;
    callback: (response: GoogleIdCredentialResponse) => void;
  }) => void;
  prompt: (callback?: (notification: GoogleIdPromptNotification) => void) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

function waitForGoogleScript(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
      if (Date.now() - start > 10_000) {
        return reject(new Error("Không tải được Google Identity Services"));
      }
      setTimeout(check, 100);
    };
    check();
  });
}

// Dùng google.accounts.id.prompt() (One Tap) thay vì renderButton() — renderButton
// vẽ nút theo style riêng của Google, không khớp được với Button component sẵn có
// của app. Nút "Tiếp tục với Google" trong app tự gọi hàm này khi bấm.
export async function signInWithGoogle(): Promise<string> {
  const accountsId = await waitForGoogleScript();

  return new Promise((resolve, reject) => {
    // settled tránh resolve/reject 2 lần (callback thành công + timeout an
    // toàn bên dưới có thể cùng bắn nếu trễ nhịp nhau).
    let settled = false;
    const settle = (run: () => void) => {
      if (settled) return;
      settled = true;
      run();
    };

    accountsId.initialize({
      client_id: env.googleClientId,
      // Google đang chuyển dần sang FedCM (cơ chế chọn tài khoản ở tầng trình
      // duyệt thay vì iframe riêng của Google) — bật tường minh theo khuyến
      // nghị, tránh cảnh báo deprecation của các method isNotDisplayed()/
      // isSkippedMoment() bên dưới ("may stop functioning when FedCM becomes
      // mandatory").
      use_fedcm_for_prompt: true,
      callback: (response) => settle(() => resolve(response.credential)),
    });

    accountsId.prompt((notification) => {
      // Bị trình duyệt/Google chặn hiện prompt (vd đã từng bấm tắt trước đó,
      // chặn cookie bên thứ 3...) — không có cách nào khác ngoài báo lỗi rõ
      // cho người dùng, không tự fallback sang renderButton() để giữ đơn giản.
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        settle(() => reject(new Error("GOOGLE_PROMPT_UNAVAILABLE")));
      }
    });

    // Bug thật đã gặp lúc test: ở 1 số trạng thái trình duyệt (vd FedCM không
    // có tài khoản Google nào khả dụng), CẢ callback thành công LẪN callback
    // notification phía trên đều không bao giờ tự bắn — thiếu timeout này,
    // Promise treo vô thời hạn, nút bấm mãi mãi ở trạng thái loading không có
    // cách nào thoát ra hay báo lỗi cho người dùng.
    setTimeout(() => settle(() => reject(new Error("GOOGLE_PROMPT_TIMEOUT"))), 10_000);
  });
}
