import { UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Ném 401 nếu chính người gọi API không còn tồn tại / đã vô hiệu hóa. */
export async function assertCallerActive(
  prisma: PrismaService,
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deactivatedAt: true },
  });
  if (!user || user.deactivatedAt) {
    throw new UnauthorizedException('Tài khoản không khả dụng');
  }
}
