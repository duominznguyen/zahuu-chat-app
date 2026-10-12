import { PermissionsAndroid, Platform } from "react-native";

import type { CallType } from "./calls";

// iOS tự hiện hộp thoại xin quyền khi WebRTC mở camera/micro lần đầu; Android
// phải xin quyền runtime trước, nếu không track tạo ra sẽ rỗng mà không báo lỗi.
export async function ensureCallPermissions(type: CallType) {
  if (Platform.OS !== "android") return true;
  const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (type === "VIDEO") wanted.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  const result = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}
