import "@livekit/components-styles";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ActiveCall } from "@/store/call-store";

interface CallRoomProps {
  call: ActiveCall;
  onDisconnected: () => void;
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

// Dùng LiveKit components có sẵn thay vì tự dựng WebRTC: layout lưới tự co theo số
// người (1-1 là 2 khung), control bar chỉ giữ mic/camera/rời — chia sẻ màn hình để sau.
export function CallRoom({ call, onDisconnected }: CallRoomProps) {
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
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <CallTiles />
        </div>
        <ControlBar
          variation="minimal"
          controls={{ microphone: true, camera: call.type === "VIDEO", screenShare: false, chat: false, leave: true }}
        />
      </div>
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
