import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

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
import type { ActionSheetItem } from "@/components/ui/action-sheet";
import { ApiError } from "@/lib/api-client";
import {
  getConversationDetail,
  removeMember,
  setNickname,
  updateMemberRole,
  type ConversationMember,
} from "@/lib/conversations";
import { useSocket } from "@/providers/socket-provider";
import { useAuthStore } from "@/store/auth-store";

export default function GroupMembers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const toast = useToast();
  const myId = useAuthStore((s) => s.user?.id);

  const [menuTarget, setMenuTarget] = useState<ConversationMember | null>(null);
  const [nicknameTarget, setNicknameTarget] =
    useState<ConversationMember | null>(null);

  const detailQuery = useQuery({
    queryKey: ["conversations", "detail", id],
    queryFn: () => getConversationDetail(id),
  });

  const invalidateDetail = () =>
    queryClient.invalidateQueries({
      queryKey: ["conversations", "detail", id],
    });

  useEffect(() => {
    if (!socket) return;
    const refresh = () => invalidateDetail();
    socket.on("group:memberAdded", refresh);
    socket.on("group:memberRemoved", refresh);
    socket.on("group:updated", refresh);
    return () => {
      socket.off("group:memberAdded", refresh);
      socket.off("group:memberRemoved", refresh);
      socket.off("group:updated", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, id]);

  const nicknameMutation = useMutation({
    mutationFn: ({ userId, nickname }: { userId: string; nickname: string }) =>
      setNickname(id, userId, nickname),
    onSuccess: () => {
      toast.show("Đã đặt biệt danh");
      setNicknameTarget(null);
      invalidateDetail();
    },
    onError: () => toast.show("Đặt biệt danh thất bại, vui lòng thử lại"),
  });

  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: "ADMIN" | "MEMBER";
    }) => updateMemberRole(id, userId, role),
    onSuccess: (_res, { role }) => {
      toast.show(role === "ADMIN" ? "Đã thăng làm admin" : "Đã giáng chức");
      invalidateDetail();
    },
    onError: (e) => {
      toast.show(
        e instanceof ApiError && e.status === 409
          ? "Không thể giáng chức vì không còn ai thay thế"
          : "Thao tác thất bại, vui lòng thử lại",
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(id, userId),
    onSuccess: () => {
      toast.show("Đã xóa khỏi nhóm");
      invalidateDetail();
    },
    onError: () => toast.show("Xóa thất bại, vui lòng thử lại"),
  });

  if (detailQuery.isError) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <Header title="Thành viên" />
        <ErrorState onRetry={() => detailQuery.refetch()} />
      </View>
    );
  }

  const members = detailQuery.data?.members ?? [];
  const iAmAdmin = detailQuery.data?.role === "ADMIN";

  const menuItems: ActionSheetItem[] = menuTarget
    ? [
        {
          key: "nickname",
          label: "Đặt biệt danh",
          icon: "pricetag-outline",
          onPress: () => setNicknameTarget(menuTarget),
        },
        ...(iAmAdmin && menuTarget.id !== myId
          ? [
              menuTarget.role === "ADMIN"
                ? {
                    key: "demote",
                    label: "Giáng xuống thành viên",
                    icon: "arrow-down-circle-outline" as const,
                    onPress: () =>
                      roleMutation.mutate({
                        userId: menuTarget.id,
                        role: "MEMBER" as const,
                      }),
                  }
                : {
                    key: "promote",
                    label: "Thăng làm admin",
                    icon: "arrow-up-circle-outline" as const,
                    onPress: () =>
                      roleMutation.mutate({
                        userId: menuTarget.id,
                        role: "ADMIN" as const,
                      }),
                  },
              {
                key: "remove",
                label: "Xóa khỏi nhóm",
                icon: "person-remove-outline" as const,
                destructive: true,
                onPress: async () => {
                  const ok = await confirm({
                    title: "Xóa khỏi nhóm?",
                    message: `${menuTarget.nickname ?? menuTarget.displayName} sẽ không còn trong nhóm này.`,
                    destructive: true,
                    confirmLabel: "Xóa",
                  });
                  if (ok) removeMutation.mutate(menuTarget.id);
                },
              },
            ]
          : []),
      ]
    : [];

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <Header
        title={`Thành viên (${members.length})`}
        right={
          <Pressable onPress={() => router.push(`/add-members/${id}`)}>
            <Ionicons name="person-add-outline" size={22} color="#71717a" />
          </Pressable>
        }
      />

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListRow
            leading={<Avatar name={item.displayName} uri={item.avatarUrl} />}
            title={item.nickname ?? item.displayName}
            subtitle={`@${item.username}`}
            onPress={() => router.push(`/user/${item.id}`)}
            trailing={
              <View className="flex-row items-center gap-3">
                {item.role === "ADMIN" && (
                  <View className="rounded-full bg-primary/10 px-2 py-1 dark:bg-primary-dark/20">
                    <Text className="text-xs font-medium text-primary dark:text-primary-dark">
                      Admin
                    </Text>
                  </View>
                )}
                <Pressable onPress={() => setMenuTarget(item)} className="p-1">
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color="#a1a1aa"
                  />
                </Pressable>
              </View>
            }
          />
        )}
      />

      <ActionSheet
        visible={!!menuTarget}
        onClose={() => setMenuTarget(null)}
        items={menuItems}
      />

      <TextPromptModal
        visible={!!nicknameTarget}
        title={`Đặt biệt danh cho ${nicknameTarget?.displayName ?? ""}`}
        initialValue={
          nicknameTarget?.nickname ?? nicknameTarget?.displayName ?? ""
        }
        maxLength={50}
        submitting={nicknameMutation.isPending}
        onCancel={() => setNicknameTarget(null)}
        onSubmit={(value) => {
          if (!nicknameTarget) return;
          nicknameMutation.mutate({
            userId: nicknameTarget.id,
            nickname: value,
          });
        }}
      />
    </View>
  );
}
