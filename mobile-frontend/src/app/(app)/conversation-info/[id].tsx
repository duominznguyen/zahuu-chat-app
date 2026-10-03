import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  ActionSheet,
  Avatar,
  ErrorState,
  Header,
  ListRow,
  TextPromptModal,
  confirm,
  useToast,
} from "@/components/ui";
import {
  disbandConversation,
  getConversationDetail,
  leaveConversation,
  setNickname,
  updateBackground,
  updateConversation,
} from "@/lib/conversations";
import { uploadMedia } from "@/lib/media";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";

export default function ConversationInfo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const toast = useToast();
  const myId = useAuthStore((s) => s.user?.id);

  const [renameOpen, setRenameOpen] = useState(false);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [backgroundSheetOpen, setBackgroundSheetOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", id],
    queryFn: () => getConversationDetail(id),
  });

  const invalidateDetail = () =>
    queryClient.invalidateQueries({
      queryKey: ["conversations", "detail", id],
    });
  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });

  useEffect(() => {
    if (!socket) return;
    const refresh = () => invalidateDetail();
    // Backend broadcast event này tới CẢ người vừa rời/bị xóa (trước khi gỡ
    // socket của họ khỏi room) — message trung lập vì không phân biệt được tự
    // rời hay bị admin xóa (2 action gọi cùng 1 event), và chính người tự rời
    // cũng có thể nhận được event này do race giữa response REST và socket.
    const onMemberRemoved = ({ userId }: { userId: string }) => {
      if (userId === myId) {
        toast.show("Bạn không còn trong nhóm này");
        router.replace("/");
        invalidateList();
        return;
      }
      refresh();
    };
    socket.on("group:memberAdded", refresh);
    socket.on("group:memberRemoved", onMemberRemoved);
    socket.on("group:updated", refresh);
    return () => {
      socket.off("group:memberAdded", refresh);
      socket.off("group:memberRemoved", onMemberRemoved);
      socket.off("group:updated", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id, myId]);

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateConversation(id, { name }),
    onSuccess: () => {
      setRenameOpen(false);
      invalidateDetail();
      invalidateList();
    },
    onError: () => toast.show("Đổi tên thất bại, vui lòng thử lại"),
  });

  const nicknameMutation = useMutation({
    mutationFn: ({
      targetId,
      nickname,
    }: {
      targetId: string;
      nickname: string;
    }) => setNickname(id, targetId, nickname),
    onSuccess: () => {
      setNicknameOpen(false);
      toast.show("Đã đặt biệt danh");
      invalidateDetail();
      invalidateList();
    },
    onError: () => toast.show("Đặt biệt danh thất bại, vui lòng thử lại"),
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveConversation(id),
    onSuccess: () => {
      router.replace("/");
      invalidateList();
    },
    onError: () => toast.show("Rời nhóm thất bại, vui lòng thử lại"),
  });

  const disbandMutation = useMutation({
    mutationFn: () => disbandConversation(id),
    onSuccess: () => {
      router.replace("/");
      invalidateList();
    },
    onError: () => toast.show("Giải tán nhóm thất bại, vui lòng thử lại"),
  });

  const pickAndUpload = async (purpose: "GROUP_AVATAR" | "BACKGROUND") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.show("Cần quyền truy cập thư viện ảnh để đổi");
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return uploadMedia(
      {
        uri: asset.uri,
        name: asset.fileName ?? "image.jpg",
        mimeType: asset.mimeType ?? "image/jpeg",
      },
      purpose,
    );
  };

  const handleChangeAvatar = async () => {
    setAvatarUploading(true);
    try {
      const uploaded = await pickAndUpload("GROUP_AVATAR");
      if (!uploaded) return;
      await updateConversation(id, { avatarUrl: uploaded.url });
      invalidateDetail();
      invalidateList();
    } catch {
      toast.show("Đổi ảnh đại diện thất bại, vui lòng thử lại");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePickNewBackground = async () => {
    setBackgroundUploading(true);
    try {
      const uploaded = await pickAndUpload("BACKGROUND");
      if (!uploaded) return;
      await updateBackground(id, uploaded.url);
      invalidateDetail();
    } catch {
      toast.show("Đổi hình nền thất bại, vui lòng thử lại");
    } finally {
      setBackgroundUploading(false);
    }
  };

  const handleRemoveBackground = async () => {
    setBackgroundUploading(true);
    try {
      await updateBackground(id, null);
      invalidateDetail();
    } catch {
      toast.show("Gỡ hình nền thất bại, vui lòng thử lại");
    } finally {
      setBackgroundUploading(false);
    }
  };

  if (detailQuery.isError) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <Header title="Thông tin" />
        <ErrorState onRetry={() => detailQuery.refetch()} />
      </View>
    );
  }

  const conv = detailQuery.data;
  const isGroup = conv?.type === "GROUP";
  const isAdmin = conv?.role === "ADMIN";
  const otherMember = conv?.members.find((m) => m.id !== myId);

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header title="Thông tin" />
      <ScrollView>
        <View className="items-center gap-2 py-6">
          <Pressable
            disabled={!isGroup || !isAdmin}
            onPress={handleChangeAvatar}
          >
            <Avatar name={conv?.name ?? "?"} uri={conv?.avatarUrl} size={88} />
            {isGroup && isAdmin && (
              <View className="absolute bottom-0 right-0 h-7 w-7 items-center justify-center rounded-full bg-primary dark:bg-primary-dark">
                {avatarUploading ? (
                  <Ionicons name="hourglass-outline" size={14} color="#fff" />
                ) : (
                  <Ionicons name="camera" size={14} color="#fff" />
                )}
              </View>
            )}
          </Pressable>
          <Text className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {conv?.name ?? "..."}
          </Text>
          {isGroup && (
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              {conv?.members.length} thành viên
            </Text>
          )}
        </View>

        <View className="border-t border-zinc-100 dark:border-zinc-800">
          {isGroup && isAdmin && (
            <ListRow
              leading={
                <Ionicons name="pencil-outline" size={22} color="#71717a" />
              }
              title="Đổi tên nhóm"
              onPress={() => setRenameOpen(true)}
            />
          )}

          <ListRow
            leading={
              <Ionicons name="image-outline" size={22} color="#71717a" />
            }
            title="Đổi hình nền"
            onPress={() => {
              if (conv?.backgroundUrl) setBackgroundSheetOpen(true);
              else handlePickNewBackground();
            }}
            trailing={
              backgroundUploading ? (
                <Ionicons name="hourglass-outline" size={18} color="#a1a1aa" />
              ) : undefined
            }
          />

          {!isGroup && (
            <ListRow
              leading={
                <Ionicons name="pricetag-outline" size={22} color="#71717a" />
              }
              title="Đặt biệt danh"
              onPress={() => setNicknameOpen(true)}
            />
          )}

          {isGroup && (
            <ListRow
              leading={
                <Ionicons name="people-outline" size={22} color="#71717a" />
              }
              title="Thành viên"
              onPress={() => router.push(`/group-members/${id}`)}
            />
          )}

          {isGroup && isAdmin && (
            <ListRow
              leading={
                <Ionicons name="link-outline" size={22} color="#71717a" />
              }
              title="Link mời"
              onPress={() => router.push(`/invite-link/${id}`)}
            />
          )}

          {isGroup && (
            <ListRow
              leading={
                <Ionicons name="exit-outline" size={22} color="#DC2626" />
              }
              title="Rời nhóm"
              titleClassName="text-danger dark:text-danger-dark"
              onPress={async () => {
                const ok = await confirm({
                  title: "Rời nhóm?",
                  destructive: true,
                  confirmLabel: "Rời nhóm",
                });
                if (ok) leaveMutation.mutate();
              }}
            />
          )}

          {isGroup && isAdmin && (
            <ListRow
              leading={
                <Ionicons name="trash-outline" size={22} color="#DC2626" />
              }
              title="Giải tán nhóm"
              titleClassName="text-danger dark:text-danger-dark"
              onPress={async () => {
                const ok = await confirm({
                  title: "Giải tán nhóm?",
                  message:
                    "Hành động này không thể hoàn tác. Toàn bộ tin nhắn sẽ bị xóa vĩnh viễn.",
                  destructive: true,
                  confirmLabel: "Giải tán",
                });
                if (ok) disbandMutation.mutate();
              }}
            />
          )}
        </View>
      </ScrollView>

      <ActionSheet
        visible={backgroundSheetOpen}
        onClose={() => setBackgroundSheetOpen(false)}
        items={[
          {
            key: "change",
            label: "Đổi ảnh khác",
            icon: "image-outline",
            onPress: handlePickNewBackground,
          },
          {
            key: "remove",
            label: "Gỡ hình nền",
            icon: "close-circle-outline",
            destructive: true,
            onPress: handleRemoveBackground,
          },
        ]}
      />

      <TextPromptModal
        visible={renameOpen}
        title="Đổi tên nhóm"
        initialValue={conv?.name ?? ""}
        maxLength={100}
        submitting={renameMutation.isPending}
        onCancel={() => setRenameOpen(false)}
        onSubmit={(value) => renameMutation.mutate(value)}
      />

      <TextPromptModal
        visible={nicknameOpen}
        title={`Đặt biệt danh cho ${otherMember?.displayName ?? ""}`}
        initialValue={otherMember?.nickname ?? otherMember?.displayName ?? ""}
        maxLength={50}
        submitting={nicknameMutation.isPending}
        onCancel={() => setNicknameOpen(false)}
        onSubmit={(value) => {
          if (!otherMember) return;
          nicknameMutation.mutate({
            targetId: otherMember.id,
            nickname: value,
          });
        }}
      />
    </View>
  );
}
