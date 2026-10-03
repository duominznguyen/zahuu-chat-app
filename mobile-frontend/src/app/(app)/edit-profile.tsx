import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  Avatar,
  Button,
  ErrorState,
  Header,
  TextField,
  useToast,
} from "@/components/ui";
import { uploadMedia } from "@/lib/media";
import {
  getMe,
  updateProfile,
  type Gender,
  type UpdateProfileInput,
} from "@/lib/users";

const GENDER_LABEL: Record<Gender, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};
const GENDER_OPTIONS: Gender[] = ["MALE", "FEMALE", "OTHER"];

export default function EditProfile() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const meQuery = useQuery({ queryKey: ["users", "me"], queryFn: getMe });

  const [avatarUrl, setAvatarUrl] = useState<string | null>();
  const [coverUrl, setCoverUrl] = useState<string | null>();
  const [displayName, setDisplayName] = useState<string>();
  const [bio, setBio] = useState<string>();
  const [birthday, setBirthday] = useState<string>();
  const [gender, setGender] = useState<Gender | null>();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const me = meQuery.data;
  // Chỉ gọi PATCH khi bấm Lưu -> state cục bộ khởi tạo (chưa gán) thì fallback
  // về giá trị đã fetch, field nào người dùng đổi thì ưu tiên giá trị mới.
  const currentAvatarUrl = avatarUrl !== undefined ? avatarUrl : me?.avatarUrl;
  const currentCoverUrl = coverUrl !== undefined ? coverUrl : me?.coverUrl;
  const currentDisplayName = displayName ?? me?.displayName ?? "";
  const currentBio = bio !== undefined ? bio : (me?.bio ?? "");
  const currentBirthday =
    birthday !== undefined ? birthday : (me?.birthday?.slice(0, 10) ?? "");
  const currentGender = gender !== undefined ? gender : (me?.gender ?? null);

  const pickAndUpload = async (purpose: "AVATAR" | "COVER") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.show("Cần quyền truy cập thư viện ảnh để đổi");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const setUploading =
      purpose === "AVATAR" ? setAvatarUploading : setCoverUploading;
    setUploading(true);
    try {
      const uploaded = await uploadMedia(
        {
          uri: asset.uri,
          name: asset.fileName ?? "image.jpg",
          mimeType: asset.mimeType ?? "image/jpeg",
        },
        purpose,
      );
      if (purpose === "AVATAR") setAvatarUrl(uploaded.url);
      else setCoverUrl(uploaded.url);
    } catch {
      toast.show("Tải ảnh lên thất bại, vui lòng thử lại");
    } finally {
      setUploading(false);
    }
  };

  const birthdayValid =
    currentBirthday.length === 0 ||
    (/^\d{4}-\d{2}-\d{2}$/.test(currentBirthday) &&
      new Date(currentBirthday) <= new Date());

  const saveMutation = useMutation({
    mutationFn: () => {
      const data: UpdateProfileInput = {
        displayName: currentDisplayName.trim(),
        bio: currentBio.trim() || null,
        birthday: currentBirthday || null,
        gender: currentGender,
        avatarUrl: currentAvatarUrl,
        coverUrl: currentCoverUrl,
      };
      return updateProfile(data);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["users", "me"], updated);
      toast.show("Đã lưu hồ sơ");
      router.back();
    },
    onError: () => toast.show("Lưu hồ sơ thất bại, vui lòng thử lại"),
  });

  if (meQuery.isError) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-950">
        <Header title="Chỉnh sửa hồ sơ" />
        <ErrorState onRetry={() => meQuery.refetch()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-zinc-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Chỉnh sửa hồ sơ" />
      <ScrollView
        contentContainerClassName="pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => pickAndUpload("COVER")}
          className="h-28 items-center justify-center bg-zinc-100 dark:bg-zinc-900"
        >
          {currentCoverUrl && (
            <Image
              source={{ uri: currentCoverUrl }}
              style={{ width: "100%", height: "100%", position: "absolute" }}
              contentFit="cover"
            />
          )}
          {coverUploading ? (
            <ActivityIndicator />
          ) : (
            <Text
              className="text-sm font-medium text-white"
              style={{ textShadowColor: "#000", textShadowRadius: 4 }}
            >
              Đổi ảnh bìa
            </Text>
          )}
        </Pressable>

        <View className="items-center">
          <Pressable
            onPress={() => pickAndUpload("AVATAR")}
            className="-mt-10 rounded-full border-4 border-white dark:border-zinc-950"
          >
            <Avatar
              name={currentDisplayName || "?"}
              uri={currentAvatarUrl}
              size={88}
            />
            {avatarUploading && (
              <View className="absolute inset-0 items-center justify-center rounded-full bg-black/30">
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </Pressable>
        </View>

        <View className="gap-4 p-6">
          <TextField
            label="Tên hiển thị"
            value={currentDisplayName}
            onChangeText={setDisplayName}
            maxLength={50}
          />
          <TextField
            label="Giới thiệu"
            value={currentBio}
            onChangeText={setBio}
            maxLength={255}
            multiline
            style={{ minHeight: 96, textAlignVertical: "top" }}
          />
          <TextField
            label="Ngày sinh"
            value={currentBirthday}
            onChangeText={setBirthday}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            error={!birthdayValid ? "Ngày sinh không hợp lệ" : undefined}
          />
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Giới tính
            </Text>
            <View className="flex-row gap-2">
              {GENDER_OPTIONS.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGender(currentGender === g ? null : g)}
                  className={`flex-1 items-center rounded-xl py-2.5 ${
                    currentGender === g
                      ? "bg-primary dark:bg-primary-dark"
                      : "bg-zinc-100 dark:bg-zinc-800"
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      currentGender === g
                        ? "text-white dark:text-zinc-900"
                        : "text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {GENDER_LABEL[g]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Button
            disabled={
              !birthdayValid ||
              currentDisplayName.trim().length === 0 ||
              saveMutation.isPending
            }
            loading={saveMutation.isPending}
            onPress={() => saveMutation.mutate()}
          >
            Lưu
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
