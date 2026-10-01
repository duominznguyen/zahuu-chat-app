import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { MemberRole } from '../../generated/prisma/enums.js';

export interface ConversationMembership {
  conversationId: string;
  userId: string;
  role: MemberRole;
}

/** Lấy membership do ConversationMemberGuard gắn vào request. */
export const Membership = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): ConversationMembership =>
    ctx
      .switchToHttp()
      .getRequest<Request & { membership: ConversationMembership }>()
      .membership,
);
