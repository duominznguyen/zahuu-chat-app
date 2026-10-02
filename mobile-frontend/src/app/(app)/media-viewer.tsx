import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/components/ui";
import { downloadAndShare } from "@/lib/media";

const MAX_SCALE = 4;

function ZoomableImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(
        1,
        Math.min(savedScale.value * e.scale, MAX_SCALE),
      );
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) reset();
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value <= 1) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
      }
    });

  const composed = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ flex: 1 }, style]}>
        <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

function VideoPlayerView({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });
  return <VideoView player={player} style={{ flex: 1 }} nativeControls />;
}

export default function MediaViewer() {
  const { url, type } = useLocalSearchParams<{
    url: string;
    type: "IMAGE" | "VIDEO";
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAndShare(url);
    } catch {
      toast.show("Tải về thất bại, vui lòng thử lại");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <View
        style={{ paddingTop: insets.top }}
        className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between px-4 py-2"
      >
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-black/40"
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Pressable
          onPress={handleDownload}
          disabled={downloading}
          className="h-10 w-10 items-center justify-center rounded-full bg-black/40"
        >
          {downloading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={22} color="#fff" />
          )}
        </Pressable>
      </View>

      {type === "VIDEO" ? (
        <VideoPlayerView uri={url} />
      ) : (
        <ZoomableImage uri={url} />
      )}
    </View>
  );
}
