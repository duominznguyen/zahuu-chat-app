import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Ném 404 nếu user (một người KHÁC, không phải người gọi API) không tồn tại hoặc đã vô hiệu hóa. */
export async function assertActiveUser(prisma: PrismaService, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deactivatedAt: true },
  });
  if (!user || user.deactivatedAt) {
    throw new NotFoundException('Không tìm thấy người dùng');
  }
}
