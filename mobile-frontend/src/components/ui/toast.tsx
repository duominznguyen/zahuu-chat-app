import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast phải gọi trong ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string) => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      setMessage(text);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
      hideTimeout.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => setMessage(null));
      }, 2000);
    },
    [opacity],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message && (
        <Animated.View
          style={{ opacity, bottom: insets.bottom + 24 }}
          className="absolute left-6 right-6 items-center rounded-xl bg-zinc-900 px-4 py-3 dark:bg-zinc-100"
        >
          <Text className="text-center text-sm font-medium text-white dark:text-zinc-900">
            {message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
