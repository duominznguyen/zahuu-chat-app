import { ForbiddenException } from '@nestjs/common';
import { ConversationType } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/** true nếu conversation là DIRECT và 1 trong 2 người đang chặn người kia. */
export async function isDirectBlocked(
  prisma: PrismaService,
  conversationId: string,
) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true, userId1: true, userId2: true },
  });
  if (
    conv?.type !== ConversationType.DIRECT ||
    !conv.userId1 ||
    !conv.userId2
  ) {
    return false;
  }
  const { userId1, userId2 } = conv;
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
    select: { blockerId: true },
  });
  return !!block;
}

/** Chặn gửi tin/gọi điện trong DIRECT khi 2 người chặn nhau. Thông báo trung
 *  lập, không nói ai chặn ai — người bị chặn không cần biết điều đó. */
export async function assertDirectNotBlocked(
  prisma: PrismaService,
  conversationId: string,
) {
  if (await isDirectBlocked(prisma, conversationId)) {
    throw new ForbiddenException({
      statusCode: 403,
      code: 'DIRECT_BLOCKED',
      message: 'Hiện không thể liên lạc với người này',
    });
  }
}
