import "@livekit/components-styles";
import {
  ControlBar,
  DisconnectButton,
  GridLayout,
  LeaveIcon,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ActiveCall } from "@/store/call-store";

interface CallRoomProps {
  call: ActiveCall;
  onDisconnected: () => void;
  nameOf: (userId: string) => string;
  minimized: boolean;
  title: string;
  onRestore: () => void;
}

// LiveKit identity = userId của server (xem livekit.service.ts), nên ánh xạ ngược được
// sang tên thành viên để hiện danh sách đang trong cuộc gọi.
function ParticipantNames({ nameOf }: { nameOf: (userId: string) => string }) {
  const participants = useParticipants();
  const names = participants.map((p) => nameOf(p.identity));
  return <p className="px-6 py-2 text-xs text-white/70">Trong cuộc gọi: {names.join(", ")}</p>;
}

function CallTiles() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });
  return (
    <GridLayout tracks={tracks} style={{ height: "100%" }}>
      <ParticipantTile />
    </GridLayout>
  );
}

// Không dùng ControlBar ở đây: nó kèm menu chọn thiết bị (chevron) mở ra ngoài pill
// và bị overflow-hidden của pill cắt mất. TrackToggle/DisconnectButton là nút đơn lẻ.
function CallPillBody({
  title,
  onRestore,
  video,
  nameOf,
}: {
  title: string;
  onRestore: () => void;
  video: boolean;
  nameOf: (userId: string) => string;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const others = participants
    .filter((p) => p.identity !== localParticipant.identity)
    .map((p) => nameOf(p.identity));
  const subtitle = others.length > 0 ? `Đang gọi · ${others.join(", ")}` : "Đang chờ người khác tham gia";
  return (
    <div className="flex h-full items-center gap-2 px-3">
      <button type="button" onClick={onRestore} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-white/70">{subtitle}</p>
      </button>
      <TrackToggle source={Track.Source.Microphone} showIcon />
      {video && <TrackToggle source={Track.Source.Camera} showIcon />}
      <DisconnectButton aria-label="Rời cuộc gọi">
        <LeaveIcon />
      </DisconnectButton>
    </div>
  );
}

// Dùng LiveKit components có sẵn thay vì tự dựng WebRTC: layout lưới tự co theo số
// người (1-1 là 2 khung), control bar chỉ giữ mic/camera/rời — chia sẻ màn hình để sau.
// Thu nhỏ KHÔNG unmount LiveKitRoom: kết nối và âm thanh vẫn giữ nguyên, chỉ đổi giao diện.
export function CallRoom({ call, onDisconnected, nameOf, minimized, title, onRestore }: CallRoomProps) {
  return (
    <LiveKitRoom
      serverUrl={call.livekitUrl}
      token={call.livekitToken}
      connect
      audio
      video={call.type === "VIDEO"}
      onDisconnected={onDisconnected}
      data-lk-theme="default"
      style={{ height: "100%" }}
    >
      {minimized ? (
        <CallPillBody title={title} onRestore={onRestore} video={call.type === "VIDEO"} nameOf={nameOf} />
      ) : (
        <div className="flex h-full flex-col">
          <ParticipantNames nameOf={nameOf} />
          <div className="min-h-0 flex-1">
            <CallTiles />
          </div>
          <ControlBar
            variation="minimal"
            controls={{ microphone: true, camera: call.type === "VIDEO", screenShare: false, chat: false, leave: true }}
          />
        </div>
      )}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

export function CallStatusLabel({ label }: { label: string }) {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-sm text-white/80">
      <Loader2 className="size-4 animate-spin" />
      {label}
      {".".repeat(dots)}
    </div>
  );
}
