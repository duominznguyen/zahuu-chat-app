import { CornerUpLeft, Copy, MoreHorizontal, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Message, ReactionType } from "@/lib/messages";

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

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  seen: boolean;
  myReaction?: ReactionType;
  onReply: () => void;
  onReact: (type: ReactionType) => void;
  onRemoveReaction: () => void;
  onRecall: () => void;
  onDelete: () => void;
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  showSenderName,
  seen,
  myReaction,
  onReply,
  onReact,
  onRemoveReaction,
  onRecall,
  onDelete,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
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
    <div className={clusterMarginClass(showAvatar)}>
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

        <div className="relative max-w-[65%]">
          {isRecalled ? (
            <div className="rounded-2xl bg-secondary px-4 py-2.5">
              <p className="text-sm italic text-muted-foreground">Tin nhắn đã thu hồi</p>
            </div>
          ) : (
            <div className={`rounded-2xl px-4 py-2.5 ${bubbleColor}`}>
              {message.replyTo && (
                <div
                  className={`mb-1.5 border-l-2 pl-2 ${isOwn ? "border-primary-foreground/50" : "border-muted-foreground/50"}`}
                >
                  <p
                    className={`truncate text-xs ${isOwn ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                  >
                    {message.replyTo.isRecalled ? "Tin nhắn đã thu hồi" : message.replyTo.content}
                  </p>
                </div>
              )}
              {message.type === "TEXT" && message.content && (
                <p className="whitespace-pre-wrap text-sm">
                  <LinkifiedText content={message.content} />
                </p>
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
