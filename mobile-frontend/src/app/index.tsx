import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { ApiError, apiClient } from '@/lib/api-client';

// Màn hình tạm để xác nhận toàn bộ toolchain (NativeWind, TanStack Query, kết
// nối backend) chạy đúng — sẽ được thay bằng flow đăng nhập thật ở milestone sau.
export default function HomeScreen() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['health-check'],
    queryFn: () => apiClient.get<string>('/'),
    retry: false,
  });

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-white px-6 dark:bg-neutral-900">
      <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Zahuu Chat</Text>
      <Text className="text-center text-neutral-500 dark:text-neutral-400">
        {isLoading && 'Đang kết nối backend...'}
        {error instanceof ApiError &&
          `Kết nối backend OK (nhận HTTP ${error.status} — route này cần đăng nhập nên bị chặn, như vậy là đúng)`}
        {error && !(error instanceof ApiError) && `Không kết nối được backend: ${error.message}`}
        {data !== undefined && `Backend trả lời: ${data}`}
      </Text>
    </View>
  );
}
