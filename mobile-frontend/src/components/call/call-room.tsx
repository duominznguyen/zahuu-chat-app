import { Ionicons } from "@expo/vector-icons";
import {
  AudioSession,
  isTrackReference,
  LiveKitRoom,
  useLocalParticipant,
  useParticipants,
  useTracks,
  VideoTrack,
  type TrackReferenceOrPlaceholder,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import type { ActiveCall } from "@/store/call-store";

export interface CallMemberInfo {
  name: string;
  avatarUrl: string | null;
}

interface CallRoomProps {
  call: ActiveCall;
  minimized: boolean;
  title: string;
  // LiveKit identity = userId (backend cấp token theo userId), nên tra ngược
  // được tên/avatar thành viên.
  memberOf: (userId: string) => CallMemberInfo;
  onLeave: () => void;
  onDisconnected: () => void;
  onConnectError: () => void;
  onRestore: () => void;
}

// Thu nhỏ KHÔNG unmount LiveKitRoom: kết nối và âm thanh giữ nguyên, chỉ đổi
// phần giao diện bên trong.
export function CallRoom({
  call,
  minimized,
  title,
  memberOf,
  onLeave,
  onDisconnected,
  onConnectError,
  onRestore,
}: CallRoomProps) {
  // Phải bật audio session trước khi kết nối, nếu không Android không định
  // tuyến âm thanh cuộc gọi (loa trong/micro) đúng cách.
  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  const isVideo = call.type === "VIDEO";
  return (
    <LiveKitRoom
      serverUrl={call.livekitUrl}
      token={call.livekitToken}
      connect
      audio
      video={isVideo}
      options={{ adaptiveStream: { pixelDensity: "screen" } }}
      onDisconnected={onDisconnected}
      // Không kết nối được tới LiveKit (mất mạng, DNS lỗi...) thì rời hẳn cuộc
      // gọi thay vì để người dùng kẹt ở màn gọi trống mà server vẫn tính là đang gọi.
      onError={onConnectError}
    >
      {minimized ? (
        <PillBody
          title={title}
          memberOf={memberOf}
          onLeave={onLeave}
          onRestore={onRestore}
        />
      ) : (
        <View className="flex-1">
          <ParticipantNames memberOf={memberOf} />
          <View className="flex-1">
            <CallTiles memberOf={memberOf} />
          </View>
          <Controls isVideo={isVideo} onLeave={onLeave} />
        </View>
      )}
    </LiveKitRoom>
  );
}

function ParticipantNames({
  memberOf,
}: {
  memberOf: (userId: string) => CallMemberInfo;
}) {
  const participants = useParticipants();
  const names = participants.map((p) => memberOf(p.identity).name);
  return (
    <Text numberOfLines={1} className="px-4 pb-2 text-xs text-white/70">
      Trong cuộc gọi: {names.join(", ")}
    </Text>
  );
}

// 1-2 người: mỗi người 1 hàng chiếm cả bề ngang; từ 3 người: lưới 2 cột. Chia
// hàng bằng flex nên không cần đo kích thước màn hình.
function CallTiles({
  memberOf,
}: {
  memberOf: (userId: string) => CallMemberInfo;
}) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );
  const perRow = tracks.length > 2 ? 2 : 1;
  const rows: TrackReferenceOrPlaceholder[][] = [];
  for (let i = 0; i < tracks.length; i += perRow) {
    rows.push(tracks.slice(i, i + perRow));
  }
  return (
    <View className="flex-1 gap-1 px-1">
      {rows.map((row, i) => (
        <View key={i} className="flex-1 flex-row gap-1">
          {row.map((trackRef) => (
            <Tile
              key={trackRef.participant.identity}
              trackRef={trackRef}
              member={memberOf(trackRef.participant.identity)}
            />
          ))}
          {row.length < perRow && <View className="flex-1" />}
        </View>
      ))}
    </View>
  );
}

function Tile({
  trackRef,
  member,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  member: CallMemberInfo;
}) {
  const hasVideo =
    isTrackReference(trackRef) && !trackRef.publication.isMuted;
  return (
    <View className="flex-1 overflow-hidden rounded-2xl bg-zinc-800">
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          style={{ flex: 1 }}
          objectFit="cover"
          mirror={trackRef.participant.isLocal}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Avatar name={member.name} uri={member.avatarUrl} size={72} />
        </View>
      )}
      <Text
        numberOfLines={1}
        className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-xs text-white"
      >
        {member.name}
      </Text>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  className,
  size = 56,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  className: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: size, height: size }}
      className={`items-center justify-center rounded-full active:opacity-70 ${className}`}
    >
      <Ionicons name={icon} size={Math.round(size * 0.45)} color="#fff" />
    </Pressable>
  );
}

function Controls({
  isVideo,
  onLeave,
}: {
  isVideo: boolean;
  onLeave: () => void;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();
  return (
    <View className="flex-row items-center justify-center gap-6 py-6">
      <RoundButton
        icon={isMicrophoneEnabled ? "mic" : "mic-off"}
        label={isMicrophoneEnabled ? "Tắt micro" : "Bật micro"}
        onPress={() =>
          void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
        }
        className={isMicrophoneEnabled ? "bg-white/20" : "bg-white/40"}
      />
      {isVideo && (
        <RoundButton
          icon={isCameraEnabled ? "videocam" : "videocam-off"}
          label={isCameraEnabled ? "Tắt camera" : "Bật camera"}
          onPress={() =>
            void localParticipant.setCameraEnabled(!isCameraEnabled)
          }
          className={isCameraEnabled ? "bg-white/20" : "bg-white/40"}
        />
      )}
      <RoundButton
        icon="call"
        label="Rời cuộc gọi"
        onPress={onLeave}
        className="rotate-[135deg] bg-danger"
      />
    </View>
  );
}

function PillBody({
  title,
  memberOf,
  onLeave,
  onRestore,
}: {
  title: string;
  memberOf: (userId: string) => CallMemberInfo;
  onLeave: () => void;
  onRestore: () => void;
}) {
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const others = participants
    .filter((p) => p.identity !== localParticipant.identity)
    .map((p) => memberOf(p.identity).name);
  const subtitle =
    others.length > 0
      ? `Đang gọi · ${others.join(", ")}`
      : "Đang chờ người khác tham gia";
  return (
    <View className="flex-1 flex-row items-center gap-2 px-3">
      <Pressable onPress={onRestore} className="flex-1">
        <Text numberOfLines={1} className="text-sm font-medium text-white">
          {title}
        </Text>
        <Text numberOfLines={1} className="text-xs text-white/70">
          {subtitle}
        </Text>
      </Pressable>
      <RoundButton
        icon={isMicrophoneEnabled ? "mic" : "mic-off"}
        label={isMicrophoneEnabled ? "Tắt micro" : "Bật micro"}
        onPress={() =>
          void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
        }
        className="bg-white/20"
        size={40}
      />
      <RoundButton
        icon="call"
        label="Rời cuộc gọi"
        onPress={onLeave}
        className="rotate-[135deg] bg-danger"
        size={40}
      />
    </View>
  );
}
