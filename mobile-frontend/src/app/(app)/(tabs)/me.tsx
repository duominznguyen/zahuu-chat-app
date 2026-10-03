import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar, ErrorState, ListRow } from "@/components/ui";
import { logout } from "@/lib/auth";
import { getMe } from "@/lib/users";

function MenuIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return <Ionicons name={name} size={22} color="#71717a" />;
}

function Chevron() {
  return <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />;
}

export default function MeTab() {
  const router = useRouter();
  const query = useQuery({ queryKey: ["users", "me"], queryFn: getMe });
  const me = query.data;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-zinc-950">
      {query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <>
          <View className="h-28 bg-zinc-100 dark:bg-zinc-900">
            {me?.coverUrl && (
              <Image
                source={{ uri: me.coverUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            )}
          </View>
          <View className="items-center">
            <View className="-mt-10 rounded-full border-4 border-white dark:border-zinc-950">
              <Avatar
                name={me?.displayName ?? "?"}
                uri={me?.avatarUrl}
                size={88}
              />
            </View>
            <Text className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {me?.displayName}
            </Text>
            <Text className="text-zinc-500 dark:text-zinc-400">
              @{me?.username}
            </Text>
            {me?.bio && (
              <Text className="mt-1 px-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {me.bio}
              </Text>
            )}
          </View>

          <View className="mt-6">
            <ListRow
              leading={<MenuIcon name="person-outline" />}
              title="Chỉnh sửa hồ sơ"
              trailing={<Chevron />}
              onPress={() => router.push("/edit-profile")}
            />
            <ListRow
              leading={<MenuIcon name="at-outline" />}
              title="Đổi username"
              trailing={<Chevron />}
              onPress={() => router.push("/change-username")}
            />
            <ListRow
              leading={<MenuIcon name="lock-closed-outline" />}
              title={me?.hasPassword ? "Đổi mật khẩu" : "Đặt mật khẩu"}
              trailing={<Chevron />}
              onPress={() =>
                router.push(
                  me?.hasPassword ? "/change-password" : "/set-password",
                )
              }
            />
            <ListRow
              leading={<MenuIcon name="ban-outline" />}
              title="Danh sách chặn"
              trailing={<Chevron />}
              onPress={() => router.push("/blocked-users")}
            />
            <ListRow
              leading={<MenuIcon name="alert-circle-outline" />}
              title="Vô hiệu hóa tài khoản"
              trailing={<Chevron />}
              onPress={() => router.push("/deactivate-account")}
            />
            <Pressable
              onPress={() => logout()}
              className="flex-row items-center gap-3 px-4 py-3 active:bg-zinc-100 dark:active:bg-zinc-800"
            >
              <MenuIcon name="log-out-outline" />
              <Text className="flex-1 text-base text-zinc-900 dark:text-zinc-100">
                Đăng xuất
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
