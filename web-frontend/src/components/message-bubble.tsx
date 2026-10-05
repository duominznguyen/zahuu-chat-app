import {
  CornerUpLeft,
  Copy,
  FileText,
  MoreHorizontal,
  Phone,
  PhoneMissed,
  PhoneOff,
  Trash2,
  Undo2,
  Video,
  VideoOff,
} from "lucide-react";
import type { CallSummary } from "@/lib/calls";
import { useState } from "react";
import { toast } from "sonner";
import { MediaPreview } from "@/components/media-preview";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { beginCall } from "@/lib/call-actions";
import { callSubtitle, callTitle } from "@/lib/calls";
import type { ConversationMember } from "@/lib/conversations";
import { formatBytes } from "@/lib/media";
import type { Message, ReactionType } from "@/lib/messages";
import { replyPreviewLabel } from "@/lib/reply-preview";
import { systemMessageText } from "@/lib/system-message";

const REACTIONS: ReactionType[] = ["like", "love", "haha", "wow", "sad", "angry"];
const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😠",
};

// Nhận diện URL http(s) trong tin nhắn text để bấm mở được — web không có
// custom scheme như mobile (zahuu://) nên chỉ cần <a> gốc, không cần tự điều
// hướng qua router (link mời dạng web là path thường /invite/:token, xử lý
// khi làm W8).
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function LinkifiedText({ content }: { content: string }) {
  const parts = content.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        URL_PATTERN.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function clusterMarginClass(isLastInCluster: boolean) {
  return isLastInCluster ? "mb-3" : "mb-1";
}

function copyText(content: string | null) {
  if (!content) return;
  navigator.clipboard.writeText(content);
  toast.success("Đã sao chép");
}

// Dùng chung cho cả 2 chỗ hiện quote trả lời (trong bubble màu, và phía trên
// MediaPreview) — thumbnail nhỏ cho IMAGE/VIDEO (mediaUrl có sẵn từ W-fix
// backend bổ sung field này vào replyTo), các loại khác chỉ hiện nhãn/text.
function ReplyQuoteContent({
  replyTo,
  textClassName,
}: {
  replyTo: NonNullable<Message["replyTo"]>;
  textClassName: string;
}) {
  const showThumb = !replyTo.isRecalled && replyTo.mediaUrl && (replyTo.type === "IMAGE" || replyTo.type === "VIDEO");
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {showThumb &&
        (replyTo.type === "IMAGE" ? (
          <img src={replyTo.mediaUrl!} alt="" className="size-7 shrink-0 rounded object-cover" />
        ) : (
          <video src={replyTo.mediaUrl!} muted preload="metadata" className="size-7 shrink-0 rounded object-cover" />
        ))}
      <p className={`truncate text-xs ${textClassName}`}>{replyPreviewLabel(replyTo)}</p>
    </div>
  );
}

// Icon theo loại + kết quả: nhỡ/từ chối dùng icon gạch, video dùng camera thay điện thoại.
function callIcon(call: CallSummary) {
  if (call.status === "MISSED") {
    return call.type === "VIDEO" ? <VideoOff className="size-4" /> : <PhoneMissed className="size-4" />;
  }
  if (call.status === "DECLINED") {
    return call.type === "VIDEO" ? <VideoOff className="size-4" /> : <PhoneOff className="size-4" />;
  }
  return call.type === "VIDEO" ? <Video className="size-4" /> : <Phone className="size-4" />;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  seen: boolean;
  isHighlighted: boolean;
  members: ConversationMember[];
  myReaction?: ReactionType;
  onReply: () => void;
  onReact: (type: ReactionType) => void;
  onRemoveReaction: () => void;
  onRecall: () => void;
  onDelete: () => void;
  onOpenMedia: () => void;
  onDownloadFile: () => void;
  onJumpToMessage: (messageId: string) => void;
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  showSenderName,
  seen,
  isHighlighted,
  members,
  myReaction,
  onReply,
  onReact,
  onRemoveReaction,
  onRecall,
  onDelete,
  onOpenMedia,
  onDownloadFile,
  onJumpToMessage,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Tin SYSTEM (sự kiện nhóm) không phải tin nhắn thật — không avatar/bong
  // bóng màu/menu "...", chỉ 1 dòng text nhỏ căn giữa. Chặn hẳn từ phía
  // client (không chỉ dựa vào backend trả 400 cho recall/reaction/reply).
  if (message.type === "SYSTEM") {
    return (
      <div id={`message-${message.id}`} className="my-2 flex justify-center px-8">
        <p className="text-center text-xs text-muted-foreground">
          {message.content ? systemMessageText(message.content, message.sender, members) : ""}
        </p>
      </div>
    );
  }

  // Lịch sử cuộc gọi không thu hồi/react/trả lời được (server chặn), nhưng vẫn hiển
  // thị như tin nhắn: nằm bên người bắt đầu cuộc gọi (giống Messenger), không căn giữa.
  if (message.type === "CALL" && message.call) {
    const call = message.call;
    return (
      <div id={`message-${message.id}`} className={`px-4 ${clusterMarginClass(showAvatar)}`}>
        {!isOwn && showSenderName && (
          <p className="mb-0.5 ml-9 text-xs font-medium text-muted-foreground">{message.sender.displayName}</p>
        )}
        <div className={`flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
          {!isOwn &&
            (showAvatar ? (
              <UserAvatar name={message.sender.displayName} src={message.sender.avatarUrl} />
            ) : (
              <div className="size-8 shrink-0" />
            ))}
          <div className="flex w-56 max-w-[70%] flex-col gap-2 rounded-2xl bg-secondary p-3">
            <div className="flex items-center gap-3 px-1">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm dark:bg-zinc-700">
                {callIcon(call)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{callTitle(call)}</p>
                <p className="text-xs text-muted-foreground">{callSubtitle(call)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void beginCall(message.conversationId, call.type)}
              className="w-full rounded-xl bg-white py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            >
              Gọi lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isRecalled = message.isRecalled;
  const reactionEmojis = isRecalled ? [] : [...new Set(message.reactions.map((r) => r.reactionType))];
  const bubbleColor = isOwn ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground";

  const menuButton = (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Thêm tùy chọn tin nhắn"
          className={`shrink-0 transition-opacity ${menuOpen ? "" : "opacity-0 group-hover/bubble:opacity-100 focus-visible:opacity-100"}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <MessageMenuContent
        align={isOwn ? "end" : "start"}
        isOwn={isOwn}
        isRecalled={isRecalled}
        canCopy={message.type === "TEXT"}
        myReaction={myReaction}
        onReply={onReply}
        onCopy={() => copyText(message.content)}
        // Nút emoji là <button> thường (không phải DropdownMenuItem) nên
        // Radix không tự đóng menu khi bấm — phải tự đóng thủ công, nếu không
        // menu đứng nguyên, chặn luôn pointer-event của cả trang phía sau.
        onReact={(type) => {
          setMenuOpen(false);
          onReact(type);
        }}
        onRemoveReaction={() => {
          setMenuOpen(false);
          onRemoveReaction();
        }}
        onRecall={onRecall}
        onDelete={onDelete}
      />
    </DropdownMenu>
  );

  return (
    <div id={`message-${message.id}`} className={clusterMarginClass(showAvatar)}>
      {!isOwn && showSenderName && (
        <p className="mb-0.5 ml-9 text-xs font-medium text-muted-foreground">
          {message.sender.displayName}
        </p>
      )}
      <div className={`group/bubble flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
        {!isOwn &&
          (showAvatar ? (
            <UserAvatar name={message.sender.displayName} src={message.sender.avatarUrl} />
          ) : (
            <div className="size-8 shrink-0" />
          ))}

        {isOwn && menuButton}

        <div
          // Ring thay vì tô nền — bubble TEXT/FILE có nền ĐẶC (bg-primary/bg-secondary)
          // phủ kín, tô nền ở wrapper ngoài sẽ bị che hoàn toàn, không thấy
          // hiệu ứng gì khi highlight; ring nằm NGOÀI border box nên luôn hiện
          // được bất kể độ trong suốt của nội dung bên trong.
          className={`relative max-w-[65%] rounded-2xl transition-shadow duration-500 ${isHighlighted ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        >
          {isRecalled ? (
            <div className="rounded-2xl bg-secondary px-4 py-2.5">
              <p className="text-sm italic text-muted-foreground">Tin nhắn đã thu hồi</p>
            </div>
          ) : message.type === "IMAGE" || message.type === "VIDEO" ? (
            message.mediaUrl && (
              <>
                {message.replyTo && (
                  <button
                    type="button"
                    onClick={() => onJumpToMessage(message.replyTo!.id)}
                    className="mb-1.5 w-full rounded-lg border-l-2 border-muted-foreground/50 bg-secondary px-2 py-1 text-left hover:bg-accent"
                  >
                    <ReplyQuoteContent replyTo={message.replyTo} textClassName="text-muted-foreground" />
                  </button>
                )}
                <MediaPreview url={message.mediaUrl} isVideo={message.type === "VIDEO"} onClick={onOpenMedia} />
              </>
            )
          ) : (
            <div className={`rounded-2xl px-4 py-2.5 ${bubbleColor}`}>
              {message.replyTo && (
                <button
                  type="button"
                  onClick={() => onJumpToMessage(message.replyTo!.id)}
                  className={`mb-1.5 w-full border-l-2 pl-2 text-left hover:opacity-80 ${isOwn ? "border-primary-foreground/50" : "border-muted-foreground/50"}`}
                >
                  <ReplyQuoteContent
                    replyTo={message.replyTo}
                    textClassName={isOwn ? "text-primary-foreground/80" : "text-muted-foreground"}
                  />
                </button>
              )}
              {message.type === "TEXT" && message.content && (
                <p className="whitespace-pre-wrap text-sm">
                  <LinkifiedText content={message.content} />
                </p>
              )}
              {message.type === "FILE" && (
                <button type="button" onClick={onDownloadFile} className="flex items-center gap-2 text-left">
                  <FileText className="size-7 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{message.mediaName ?? "File"}</p>
                    {message.mediaSize != null && (
                      <p className={`text-xs ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {formatBytes(message.mediaSize)}
                      </p>
                    )}
                  </div>
                </button>
              )}
            </div>
          )}

          {!!reactionEmojis.length && (
            <div className="absolute -bottom-2.5 right-1 flex rounded-full border border-border bg-background px-1.5 py-0.5">
              {reactionEmojis.map((r) => (
                <span key={r} className="text-xs">
                  {REACTION_EMOJI[r]}
                </span>
              ))}
            </div>
          )}
        </div>

        {!isOwn && menuButton}
      </div>

      {seen && <p className="-mt-1 mb-2 text-right text-xs text-muted-foreground">Đã xem</p>}
    </div>
  );
}

function MessageMenuContent({
  align,
  isOwn,
  isRecalled,
  canCopy,
  myReaction,
  onReply,
  onCopy,
  onReact,
  onRemoveReaction,
  onRecall,
  onDelete,
}: {
  align: "start" | "end";
  isOwn: boolean;
  isRecalled: boolean;
  canCopy: boolean;
  myReaction?: ReactionType;
  onReply: () => void;
  onCopy: () => void;
  onReact: (type: ReactionType) => void;
  onRemoveReaction: () => void;
  onRecall: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenuContent align={align} className="w-56">
      {!isRecalled && (
        <>
          <div className="flex justify-around px-1 py-1.5">
            {REACTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className="rounded-full p-1 text-lg hover:bg-accent"
                onClick={() => (myReaction === r ? onRemoveReaction() : onReact(r))}
              >
                {REACTION_EMOJI[r]}
              </button>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onReply}>
            <CornerUpLeft />
            Trả lời
          </DropdownMenuItem>
          {canCopy && (
            <DropdownMenuItem onClick={onCopy}>
              <Copy />
              Sao chép
            </DropdownMenuItem>
          )}
        </>
      )}
      {isOwn && !isRecalled && (
        <DropdownMenuItem variant="destructive" onClick={onRecall}>
          <Undo2 />
          Thu hồi
        </DropdownMenuItem>
      )}
      <DropdownMenuItem variant="destructive" onClick={onDelete}>
        <Trash2 />
        Xóa (chỉ ở máy tôi)
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
