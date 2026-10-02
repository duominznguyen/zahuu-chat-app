import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "zahuu_access_token";
const REFRESH_TOKEN_KEY = "zahuu_refresh_token";

// expo-secure-store không hỗ trợ web (implementation web của chính package là
// object rỗng, gọi method nào cũng crash) — app không nhắm tới web (có repo
// web-frontend riêng, xem CLAUDE.md), nền tảng này chỉ dùng để Claude tự kiểm
// tra UI. Trên web: coi như không có session lưu sẵn, không crash.
const isWeb = Platform.OS === "web";

// Refresh token phải nằm trong Keychain/Keystore (expo-secure-store), không AsyncStorage —
// đây là credential sống lâu (TTL theo ngày), lộ ra là chiếm được tài khoản vô thời hạn.
export const tokenStorage = {
  getAccessToken: () =>
    isWeb ? Promise.resolve(null) : SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  getRefreshToken: () =>
    isWeb ? Promise.resolve(null) : SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  async setTokens(accessToken: string, refreshToken: string) {
    if (isWeb) return;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },
  async clear() {
    if (isWeb) return;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },
};
