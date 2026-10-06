import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

// LiveKit cần native module WebRTC: chỉ có trong bản build Dev Client. Nạp nó
// trên Expo Go hoặc web sẽ crash cả app, nên mọi phần gọi điện đều kiểm tra
// cờ này trước.
export const isCallingSupported =
  Platform.OS !== "web" &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
