import { Vibration } from "react-native";

// Rung lặp thay cho chuông: không cần file âm thanh hay thêm thư viện phát nhạc.
const PATTERN = [0, 800, 700];

export function startRingtone() {
  Vibration.vibrate(PATTERN, true);
}

export function stopRingtone() {
  Vibration.cancel();
}
