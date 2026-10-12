import { describe, expect, it } from 'vitest';
import { CallStatus } from '../generated/prisma/enums.js';
import { resolveCallOutcome, type CallParticipantState } from './call-outcome.js';

const CALLER = 'caller';
const at = new Date('2026-10-05T10:00:00Z');

const caller = (over: Partial<CallParticipantState> = {}): CallParticipantState => ({
  userId: CALLER,
  joinedAt: at,
  leftAt: null,
  ...over,
});
const ringing = (userId: string): CallParticipantState => ({ userId, joinedAt: null, leftAt: null });
const declined = (userId: string): CallParticipantState => ({ userId, joinedAt: null, leftAt: at });
const joined = (userId: string): CallParticipantState => ({ userId, joinedAt: at, leftAt: null });
const left = (userId: string): CallParticipantState => ({ userId, joinedAt: at, leftAt: at });

describe('resolveCallOutcome — RINGING', () => {
  it('chưa kết thúc khi còn người đang đổ chuông', () => {
    expect(resolveCallOutcome(CallStatus.RINGING, CALLER, [caller(), ringing('b')])).toBeNull();
  });

  it('DIRECT: người nhận từ chối là kết thúc DECLINED', () => {
    expect(resolveCallOutcome(CallStatus.RINGING, CALLER, [caller(), declined('b')])).toBe('DECLINED');
  });

  it('GROUP: 1 người từ chối nhưng người khác còn đổ chuông thì tiếp tục', () => {
    expect(
      resolveCallOutcome(CallStatus.RINGING, CALLER, [caller(), declined('b'), ringing('c')]),
    ).toBeNull();
  });

  it('GROUP: tất cả đều từ chối thì DECLINED', () => {
    expect(
      resolveCallOutcome(CallStatus.RINGING, CALLER, [caller(), declined('b'), declined('c')]),
    ).toBe('DECLINED');
  });

  it('không ai từ chối nhưng hết đổ chuông (vd timeout) thì MISSED', () => {
    expect(resolveCallOutcome(CallStatus.RINGING, CALLER, [caller(), left('b')])).toBe('MISSED');
  });

  it('người gọi tự huỷ trước khi có ai bắt máy là MISSED, kể cả khi còn người đang đổ chuông', () => {
    expect(
      resolveCallOutcome(CallStatus.RINGING, CALLER, [caller({ leftAt: at }), ringing('b'), ringing('c')]),
    ).toBe('MISSED');
  });
});

describe('resolveCallOutcome — ONGOING', () => {
  it('2 người đang trong cuộc gọi thì tiếp tục', () => {
    expect(resolveCallOutcome(CallStatus.ONGOING, CALLER, [caller(), joined('b')])).toBeNull();
  });

  it('chỉ còn 1 người active thì ENDED', () => {
    expect(resolveCallOutcome(CallStatus.ONGOING, CALLER, [caller(), left('b')])).toBe('ENDED');
  });

  it('GROUP: người rời nhưng vẫn còn từ 2 người active thì tiếp tục', () => {
    expect(
      resolveCallOutcome(CallStatus.ONGOING, CALLER, [caller(), joined('b'), joined('c'), left('d')]),
    ).toBeNull();
  });

  it('GROUP: người đang đổ chuông không tính là active', () => {
    expect(
      resolveCallOutcome(CallStatus.ONGOING, CALLER, [caller(), left('b'), ringing('c')]),
    ).toBe('ENDED');
  });
});
