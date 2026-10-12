importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

// Config đi qua query string lúc register (xem src/lib/web-push.ts) thay vì
// hardcode: service worker không đọc được import.meta.env của Vite, và không
// muốn cùng 1 config phải sửa ở 2 chỗ.
firebase.initializeApp(Object.fromEntries(new URL(self.location.href).searchParams));
firebase.messaging();

// Backend gửi kèm field notification nên trình duyệt tự hiện thông báo khi tab
// không focus — chỉ cần xử lý click để mở/focus app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => "focus" in w);
      return existing ? existing.focus() : clients.openWindow("/");
    }),
  );
});
