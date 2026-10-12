import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { apiClient } from "./api-client";

const SW_PATH = "/firebase-messaging-sw.js";

// Thiếu bất kỳ biến nào thì coi như chưa bật push — KHÔNG throw như env.ts vì
// app phải chạy bình thường khi chưa cấu hình Firebase (xem web-push-plan.md).
const firebaseConfig: Record<string, string> | null = (() => {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  return Object.values(config).every(Boolean) ? (config as Record<string, string>) : null;
})();

const VAPID_KEY: string | undefined = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export const isPushConfigured = firebaseConfig !== null && !!VAPID_KEY;

export function isPushPermissionGranted() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function isPushPermissionDenied() {
  return typeof Notification !== "undefined" && Notification.permission === "denied";
}

export async function isPushSupported() {
  return isPushConfigured && (await isSupported());
}

function getFirebaseApp(config: FirebaseOptions) {
  return getApps().length > 0 ? getApp() : initializeApp(config);
}

async function fetchFcmToken(config: Record<string, string>) {
  const app = getFirebaseApp(config);
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    `${SW_PATH}?${new URLSearchParams(config)}`,
  );
  // Lần đầu đăng ký, SW còn đang cài đặt — subscribe() của PushManager sẽ lỗi
  // "no active Service Worker" nếu gọi trước khi nó active.
  await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration });
}

async function registerDeviceToken(config: Record<string, string>) {
  const fcmToken = await fetchFcmToken(config);
  await apiClient.post("/device-tokens", { fcmToken, platform: "WEB" });
  return fcmToken;
}

export type EnableWebPushResult = "enabled" | "unsupported" | "denied";

// Chỉ gọi khi người dùng chủ động bấm "Bật thông báo" — gọi requestPermission()
// ngoài cử chỉ đó sẽ bị trình duyệt chặn hoặc tự đánh dấu là từ chối.
export async function enableWebPush(): Promise<EnableWebPushResult> {
  if (!firebaseConfig || !(await isPushSupported())) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  await registerDeviceToken(firebaseConfig);
  return "enabled";
}

// Quyền đã cấp từ trước: lấy lại token (không hiện prompt) và đăng ký lại với
// backend — để trình duyệt vừa đăng nhập lại (sau khi logout đã xoá token)
// vẫn nhận được push mà không phải bấm nút lần nữa.
export async function syncWebPushTokenIfGranted() {
  if (!firebaseConfig || !isPushPermissionGranted() || !(await isPushSupported())) return;
  await registerDeviceToken(firebaseConfig);
}

// Dùng lúc logout để backend xoá đúng DeviceToken của trình duyệt này (xem
// auth.service.ts). Chỉ đọc token đã có, không prompt, không đăng ký mới.
export async function getCurrentFcmToken(): Promise<string | null> {
  if (!firebaseConfig || !isPushPermissionGranted() || !(await isPushSupported())) return null;
  return fetchFcmToken(firebaseConfig);
}
