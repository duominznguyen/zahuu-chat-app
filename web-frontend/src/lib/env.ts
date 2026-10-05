function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} — kiểm tra file .env (xem .env.example)`);
  }
  return value;
}

export const env = {
  apiUrl: required("VITE_API_URL", import.meta.env.VITE_API_URL),
  socketUrl: required("VITE_SOCKET_URL", import.meta.env.VITE_SOCKET_URL),
  googleClientId: required(
    "VITE_GOOGLE_CLIENT_ID",
    import.meta.env.VITE_GOOGLE_CLIENT_ID,
  ),
};
