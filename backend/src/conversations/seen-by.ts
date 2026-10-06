export const SEEN_BY_MAX_AVATARS = 5;

export interface MessageCursor {
  id: string;
  createdAt: Date;
}

export interface SeenCandidate<U> {
  userId: string;
  cursor: MessageCursor;
  user: U;
}

// Cùng thứ tự với listMessages (createdAt desc, id desc). Dương nghĩa là a mới hơn b.
export function compareCursor(a: MessageCursor, b: MessageCursor): number {
  const diff = a.createdAt.getTime() - b.createdAt.getTime();
  if (diff !== 0) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function pickSeenBy<U>(
  anchor: MessageCursor & { senderId: string },
  candidates: SeenCandidate<U>[],
  viewerId: string,
) {
  const readers = candidates
    .filter((c) => c.userId !== viewerId && c.userId !== anchor.senderId)
    .filter((c) => compareCursor(c.cursor, anchor) >= 0)
    .sort((a, b) => compareCursor(b.cursor, a.cursor));

  return {
    users: readers.slice(0, SEEN_BY_MAX_AVATARS).map((r) => r.user),
    count: readers.length,
  };
}
