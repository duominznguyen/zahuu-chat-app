import { randomBytes } from 'node:crypto';
import type { PrismaService } from '../../prisma/prisma.service.js';

/** Tạo @handle từ 1 chuỗi gốc (thường là phần trước @ của email). */
export async function generateUniqueUsername(
  prisma: PrismaService,
  seed: string,
) {
  const base =
    seed
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_.]/g, '')
      .slice(0, 20) || 'user';

  for (let i = 0; i < 5; i++) {
    const candidate = `${base}_${randomBytes(3).toString('hex')}`;
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new Error('Không sinh được username duy nhất');
}
