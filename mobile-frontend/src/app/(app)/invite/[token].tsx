import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Avatar, Button, ErrorState, useToast } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { joinByInviteToken, previewInviteLink } from "@/lib/conversations";

// Màn xem trước nhóm trước khi join (xử lý deep link zahuu://invite/<token>,
// tạo ở InviteLink) — không join thẳng ngay khi mở link như trước, phải xác
// nhận giống Zalo: tự ý thêm người vào nhóm mà không hỏi là trải nghiệm xấu.
export default function JoinByInvite() {
  const { token, from } = useLocalSearchParams<{
    token: string;
    from?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // staleTime/gcTime = 0: trạng thái "đã là thành viên chưa" đổi liên tục
  // (rời/join nhóm) nên KHÔNG được dùng cache mặc định 30s của app — rời nhóm
  // rồi bấm lại link ngay sẽ đọc nhầm kết quả cũ (đã xảy ra thật), gcTime=0
  // đảm bảo không giữ lại cache giữa các lần mount màn này.
  const previewQuery = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => previewInviteLink(token),
    staleTime: 0,
    gcTime: 0,
  });

  // Đã là thành viên rồi -> vào thẳng luôn, không có gì để xác nhận thêm
  // (đúng theo cách Zalo xử lý) — cũng là cách tránh join lại vô ích nếu bấm
  // đi bấm lại link mời cũ ngay trong chính đoạn chat đó.
  useEffect(() => {
    if (!previewQuery.data?.alreadyMember) return;
    const targetId = previewQuery.data.conversationId;
    // Link trỏ ĐÚNG về conversation đang xem lúc bấm (vd admin dán link mời
    // ngay trong chính nhóm đó) -> back() về lại màn cũ, KHÔNG push 1 instance
    // mới của cùng conversation (bấm lặp lại sẽ chồng màn vô hạn).
    if (from === targetId && router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/conversation/${targetId}`);
    }
  }, [previewQuery.data, from, router]);

  const joinMutation = useMutation({
    mutationFn: () => joinByInviteToken(token),
    onSuccess: (conv) => {
      toast.show(`Đã tham gia nhóm ${conv.name ?? ""}`);
      // Chủ động invalidate thay vì chỉ chờ socket group:memberAdded — màn
      // ChatsList có thể chưa từng mở nên chưa kịp lắng nghe event đó, nhóm
      // mới join sẽ không tự xuất hiện cho tới khi cache hết hạn.
      queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
      router.replace(`/conversation/${conv.id}`);
    },
    onError: () => toast.show("Tham gia nhóm thất bại, vui lòng thử lại"),
  });

  const handleCancel = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  if (previewQuery.isLoading || previewQuery.data?.alreadyMember) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-950">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (previewQuery.isError) {
    const message =
      previewQuery.error instanceof ApiError &&
      previewQuery.error.status === 404
        ? "Link mời không hợp lệ hoặc đã bị thu hồi"
        : "Không tải được thông tin nhóm, vui lòng thử lại";
    return (
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <ErrorState message={message} onRetry={() => previewQuery.refetch()} />
      </View>
    );
  }

  const preview = previewQuery.data;
  if (!preview) return null;

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white px-8 dark:bg-zinc-950">
      <Avatar name={preview.name} uri={preview.avatarUrl} size={96} />
      <View className="items-center gap-1">
        <Text className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {preview.name}
        </Text>
        <Text className="text-zinc-500 dark:text-zinc-400">
          {preview.memberCount} thành viên
        </Text>
      </View>
      <Text className="text-center text-zinc-500 dark:text-zinc-400">
        Bạn được mời tham gia nhóm này
      </Text>

      <View className="w-full gap-3 pt-4">
        <Button
          loading={joinMutation.isPending}
          onPress={() => joinMutation.mutate()}
        >
          Tham gia nhóm
        </Button>
        <Button
          variant="secondary"
          disabled={joinMutation.isPending}
          onPress={handleCancel}
        >
          Huỷ
        </Button>
      </View>
    </View>
  );
}
