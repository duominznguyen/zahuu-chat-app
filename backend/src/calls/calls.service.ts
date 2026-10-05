import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { assertCallerActive } from '../common/assert-caller-active.js';
import { isUniqueViolation } from '../common/prisma-errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  CallStatus,
  CallType,
  MessageType,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { resolveCallOutcome, type FinalCallStatus } from './call-outcome.js';
import { LivekitService } from './livekit.service.js';

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const callSummarySelect = {
  id: true,
  type: true,
  status: true,
  startedAt: true,
  endedAt: true,
} as const;

const callMessageSelect = {
  id: true,
  conversationId: true,
  type: true,
  createdAt: true,
  sender: { select: publicUserSelect },
  call: { select: callSummarySelect },
} as const;

type CallMessage = Prisma.MessageGetPayload<{
  select: typeof callMessageSelect;
}>;

interface EndedCall {
  callId: string;
  conversationId: string;
  status: FinalCallStatus;
  message: CallMessage;
}

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
    private readonly events: EventEmitter2,
  ) {}

  async startCall(conversationId: string, userId: string, type: CallType) {
    await assertCallerActive(this.prisma, userId);

    const callId = randomUUID();
    const livekitRoomName = `call-${callId}`;
    // Token cấp TRƯỚC khi ghi DB — thiếu cấu hình LiveKit thì không để lại cuộc gọi RINGING treo.
    const livekitToken = await this.livekit.issueToken(livekitRoomName, userId);

    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const startedAt = new Date();

    let call;
    try {
      call = await this.prisma.call.create({
        data: {
          id: callId,
          conversationId,
          activeConversationId: conversationId,
          startedById: userId,
          type,
          livekitRoomName,
          startedAt,
          participants: {
            create: members.map((m) => ({
              userId: m.userId,
              joinedAt: m.userId === userId ? startedAt : null,
            })),
          },
        },
        select: {
          id: true,
          conversationId: true,
          type: true,
          startedBy: { select: publicUserSelect },
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException({
          code: 'CALL_IN_PROGRESS',
          message: 'Cuộc trò chuyện này đang có cuộc gọi',
        });
      }
      throw e;
    }

    this.events.emit('call.started', {
      callId: call.id,
      conversationId: call.conversationId,
      type: call.type,
      startedById: userId,
      startedBy: call.startedBy,
    });

    return {
      callId: call.id,
      type: call.type,
      livekitRoomName,
      livekitToken,
      livekitUrl: this.livekit.url,
    };
  }

  async joinCall(callId: string, userId: string) {
    await assertCallerActive(this.prisma, userId);
    const call = await this.loadCallForMember(callId, userId);
    if (call.status !== CallStatus.RINGING && call.status !== CallStatus.ONGOING) {
      throw new ConflictException({
        code: 'CALL_ENDED',
        message: 'Cuộc gọi đã kết thúc',
      });
    }
    const me = call.participants.find((p) => p.userId === userId)!;
    if (me.joinedAt === null && me.leftAt !== null) {
      throw new ConflictException({
        code: 'CALL_DECLINED',
        message: 'Bạn đã từ chối cuộc gọi này',
      });
    }

    const livekitToken = await this.livekit.issueToken(
      call.livekitRoomName,
      userId,
    );

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.callParticipant.update({
        where: { callId_userId: { callId, userId } },
        data: { joinedAt: me.joinedAt ?? now, leftAt: null },
      });
      if (call.status === CallStatus.RINGING) {
        await tx.call.updateMany({
          where: { id: callId, status: CallStatus.RINGING },
          data: { status: CallStatus.ONGOING },
        });
      }
    });

    this.events.emit('call.participantJoined', {
      callId,
      conversationId: call.conversationId,
      userId,
    });

    return {
      livekitRoomName: call.livekitRoomName,
      livekitToken,
      livekitUrl: this.livekit.url,
    };
  }

  async declineCall(callId: string, userId: string) {
    await this.endParticipation(callId, userId);
  }

  async leaveCall(callId: string, userId: string) {
    await this.endParticipation(callId, userId);
  }

  async getCall(callId: string, userId: string) {
    const call = await this.loadCallForMember(callId, userId);
    return {
      id: call.id,
      conversationId: call.conversationId,
      type: call.type,
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      participants: call.participants.map((p) => ({
        user: p.user,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
      })),
    };
  }

  /** Gọi từ webhook LiveKit `participant_left` — nguồn đáng tin cậy khi client đã đóng tab/mất mạng. */
  async handleParticipantLeft(livekitRoomName: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { livekitRoomName },
      select: { id: true },
    });
    if (call) await this.endParticipation(call.id, userId);
  }

  /** Gọi từ webhook LiveKit `room_finished` — chốt mọi người còn lại đã ra khỏi cuộc gọi. */
  async handleRoomFinished(livekitRoomName: string) {
    const call = await this.prisma.call.findUnique({
      where: { livekitRoomName },
      select: { id: true },
    });
    if (!call) return;

    const ended = await this.prisma.$transaction(async (tx) => {
      const current = await tx.call.findUnique({
        where: { id: call.id },
        select: {
          status: true,
          conversationId: true,
          startedById: true,
          participants: {
            select: { userId: true, joinedAt: true, leftAt: true },
          },
        },
      });
      if (!current || !isActiveStatus(current.status)) return null;

      const now = new Date();
      await tx.callParticipant.updateMany({
        where: { callId: call.id, leftAt: null },
        data: { leftAt: now },
      });
      const participants = current.participants.map((p) => ({
        ...p,
        leftAt: p.leftAt ?? now,
      }));
      const final = resolveCallOutcome(
        current.status,
        current.startedById,
        participants,
      );
      if (!final) return null;
      return this.finalizeCall(
        tx,
        call.id,
        current.conversationId,
        current.startedById,
        final,
      );
    });

    if (ended) this.emitEnded(ended);
  }

  /**
   * Chung cho REST `/leave`/`/decline` và webhook `participant_left`: đánh dấu rời,
   * rồi nếu cuộc gọi đã đủ điều kiện kết thúc thì chốt trạng thái cuối trong cùng transaction.
   */
  private async endParticipation(callId: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.call.findUnique({
        where: { id: callId },
        select: {
          status: true,
          conversationId: true,
          startedById: true,
          participants: {
            select: { userId: true, joinedAt: true, leftAt: true },
          },
        },
      });
      const noop = { leftNow: false, conversationId: '', ended: null };
      if (!current || !isActiveStatus(current.status)) return noop;
      const me = current.participants.find((p) => p.userId === userId);
      if (!me || me.leftAt !== null) return noop;

      const now = new Date();
      await tx.callParticipant.update({
        where: { callId_userId: { callId, userId } },
        data: { leftAt: now },
      });
      const participants = current.participants.map((p) =>
        p.userId === userId ? { ...p, leftAt: now } : p,
      );
      const final = resolveCallOutcome(
        current.status,
        current.startedById,
        participants,
      );
      const ended = final
        ? await this.finalizeCall(
            tx,
            callId,
            current.conversationId,
            current.startedById,
            final,
          )
        : null;
      return { leftNow: true, conversationId: current.conversationId, ended };
    });

    if (result.leftNow) {
      this.events.emit('call.participantLeft', {
        callId,
        conversationId: result.conversationId,
        userId,
      });
    }
    if (result.ended) this.emitEnded(result.ended);
  }

  /** Chốt trạng thái cuối + tạo tin CALL trong transaction. Trả null nếu cuộc gọi đã được chốt bởi request khác. */
  private async finalizeCall(
    tx: Prisma.TransactionClient,
    callId: string,
    conversationId: string,
    startedById: string,
    status: FinalCallStatus,
  ): Promise<EndedCall | null> {
    const now = new Date();
    const updated = await tx.call.updateMany({
      where: { id: callId, status: { in: [CallStatus.RINGING, CallStatus.ONGOING] } },
      data: { status, endedAt: now, activeConversationId: null },
    });
    if (updated.count === 0) return null;

    await tx.callParticipant.updateMany({
      where: { callId, leftAt: null },
      data: { leftAt: now },
    });

    const message = await tx.message.create({
      data: { conversationId, senderId: startedById, type: MessageType.CALL, callId },
      select: callMessageSelect,
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt, lastMessageId: message.id },
    });
    return { callId, conversationId, status, message };
  }

  /** Emit SAU commit: client nhận `message:new` như tin thường, và `call:ended` để đóng UI đang mở. */
  private emitEnded({ callId, conversationId, status, message }: EndedCall) {
    this.events.emit('message.created', {
      conversationId,
      message: {
        id: message.id,
        conversationId,
        sender: message.sender,
        type: message.type,
        content: null,
        mediaUrl: null,
        mediaPublicId: null,
        mediaName: null,
        mediaSize: null,
        replyTo: null,
        isRecalled: false,
        recalledAt: null,
        createdAt: message.createdAt,
        reactions: [],
        call: message.call,
      },
    });
    this.events.emit('call.ended', { callId, conversationId, status });
  }

  private async loadCallForMember(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        conversationId: true,
        type: true,
        status: true,
        startedById: true,
        livekitRoomName: true,
        startedAt: true,
        endedAt: true,
        participants: {
          select: {
            userId: true,
            joinedAt: true,
            leftAt: true,
            user: { select: publicUserSelect },
          },
        },
      },
    });
    const notFound = () =>
      new NotFoundException('Không tìm thấy cuộc gọi');
    if (!call) throw notFound();
    if (!call.participants.some((p) => p.userId === userId)) throw notFound();

    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: call.conversationId, userId },
      },
      select: { userId: true },
    });
    if (!member) throw notFound();
    return call;
  }
}

function isActiveStatus(status: CallStatus) {
  return status === CallStatus.RINGING || status === CallStatus.ONGOING;
}
