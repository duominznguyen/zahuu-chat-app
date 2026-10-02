import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'zahuu_access_token';
const REFRESH_TOKEN_KEY = 'zahuu_refresh_token';

// Refresh token phải nằm trong Keychain/Keystore (expo-secure-store), không AsyncStorage —
// đây là credential sống lâu (TTL theo ngày), lộ ra là chiếm được tài khoản vô thời hạn.
export const tokenStorage = {
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  async setTokens(accessToken: string, refreshToken: string) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },
};
