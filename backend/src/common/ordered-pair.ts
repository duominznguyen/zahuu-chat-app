/** Sắp xếp cặp id (nhỏ trước) cho quan hệ không hướng (Friendship, direct Conversation)*/
export function orderedPair(a: string, b: string) {
  return a < b ? { userId1: a, userId2: b } : { userId1: b, userId2: a };
}
