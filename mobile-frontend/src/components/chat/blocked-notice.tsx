import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/components/ui";
import { DIRECT_BLOCKED_MESSAGE } from "@/lib/conversations";
import { getUserProfile, unblockUser } from "@/lib/friends";

// Thay cho ô nhập tin trong đoạn chat 1-1 khi 2 người chặn nhau. Chỉ người đã
// chặn mới thấy lý do + nút Bỏ chặn; người bị chặn chỉ thấy câu trung lập
// (profile của người chặn trả 404 với họ).
export function BlockedNotice({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const profileQuery = useQuery({
    queryKey: ["users", "profile", userId],
    queryFn: () => getUserProfile(userId),
  });
  // Refetch lỗi (vừa bị chặn → 404) vẫn giữ data cũ, nên bỏ qua data khi đang lỗi.
  const blockedByMe =
    !profileQuery.isError &&
    profileQuery.data?.relationshipStatus === "blocked";

  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(userId),
    onSuccess: () => {
      toast.show("Đã bỏ chặn");
      queryClient.invalidateQueries({ queryKey: ["users", "profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["blocks"] });
      queryClient.invalidateQueries({ queryKey: ["conversations", "detail"] });
    },
    onError: () => toast.show("Bỏ chặn thất bại, vui lòng thử lại"),
  });

  return (
    <View
      style={{ paddingBottom: insets.bottom || 12 }}
      className="flex-row items-center justify-center gap-3 border-t border-zinc-200 bg-white px-4 pt-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <Text className="shrink text-sm text-zinc-500 dark:text-zinc-400">
        {blockedByMe ? "Bạn đã chặn người này" : DIRECT_BLOCKED_MESSAGE}
      </Text>
      {blockedByMe && (
        <Pressable
          accessibilityLabel="Bỏ chặn"
          disabled={unblockMutation.isPending}
          onPress={() => unblockMutation.mutate()}
          className={`rounded-full border border-zinc-300 px-3 py-1.5 active:opacity-70 dark:border-zinc-600 ${unblockMutation.isPending ? "opacity-50" : ""}`}
        >
          <Text className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Bỏ chặn
          </Text>
        </Pressable>
      )}
    </View>
  );
}
