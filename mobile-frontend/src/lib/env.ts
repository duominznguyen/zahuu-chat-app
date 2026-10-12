function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} — kiểm tra file .env (xem .env.example)`);
  }
  return value;
}

export const env = {
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  socketUrl: required('EXPO_PUBLIC_SOCKET_URL', process.env.EXPO_PUBLIC_SOCKET_URL),
  // Gốc của web app — link mời tạo ở mobile dùng chung dạng URL với web để mở
  // được trên máy không cài app.
  webUrl: required('EXPO_PUBLIC_WEB_URL', process.env.EXPO_PUBLIC_WEB_URL),
};
