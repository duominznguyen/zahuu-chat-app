/** Lỗi vi phạm ràng buộc unique của Prisma (P2002). */
export const isUniqueViolation = (e: unknown) =>
  typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002';
