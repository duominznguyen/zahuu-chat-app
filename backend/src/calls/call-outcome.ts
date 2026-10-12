import { CallStatus } from '../generated/prisma/enums.js';

export interface CallParticipantState {
  userId: string;
  joinedAt: Date | null;
  leftAt: Date | null;
}

export type FinalCallStatus = 'ENDED' | 'MISSED' | 'DECLINED';

const isActive = (p: CallParticipantState) =>
  p.joinedAt !== null && p.leftAt === null;

const isRinging = (p: CallParticipantState) =>
  p.joinedAt === null && p.leftAt === null;

// Đã từ chối (hoặc bỏ máy khi đang đổ chuông) = chưa từng bắt máy nhưng đã có leftAt.
const hasLeftWithoutAnswering = (p: CallParticipantState) =>
  p.joinedAt === null && p.leftAt !== null;

/**
 * Trả về trạng thái cuối nếu cuộc gọi phải kết thúc sau thay đổi vừa rồi, `null` nếu
 * vẫn tiếp tục. Gọi trong cùng transaction với lúc ghi `leftAt`/`joinedAt`.
 *
 * RINGING = chưa ai ngoài người gọi bắt máy (người bắt máy đầu tiên chuyển sang ONGOING).
 */
export function resolveCallOutcome(
  status: CallStatus,
  callerId: string,
  participants: CallParticipantState[],
): FinalCallStatus | null {
  if (status === CallStatus.ONGOING) {
    return participants.filter(isActive).length <= 1 ? 'ENDED' : null;
  }

  const caller = participants.find((p) => p.userId === callerId);
  // Người gọi tự huỷ trước khi có ai bắt máy → cuộc gọi nhỡ, không cần đợi những người còn đang đổ chuông.
  if (caller?.leftAt) return 'MISSED';

  const callees = participants.filter((p) => p.userId !== callerId);
  if (callees.some(isRinging)) return null;
  return callees.some(hasLeftWithoutAnswering) ? 'DECLINED' : 'MISSED';
}
