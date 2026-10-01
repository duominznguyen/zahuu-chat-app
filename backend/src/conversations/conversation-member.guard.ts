import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ConversationMembership } from './decorators/membership.decorator.js';

/** mọi endpoint /conversations/:id/* phải qua guard này. */
@Injectable()
export class ConversationMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<
        Request & { user?: AuthUser; membership?: ConversationMembership }
      >();
    const conversationId = String(request.params.id ?? '');
    const userId = request.user?.id;
    const notFound = () =>
      new NotFoundException('Không tìm thấy cuộc trò chuyện');
    if (!userId || !conversationId) throw notFound();

    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { role: true },
    });
    if (!member) throw notFound();

    request.membership = { conversationId, userId, role: member.role };
    return true;
  }
}
