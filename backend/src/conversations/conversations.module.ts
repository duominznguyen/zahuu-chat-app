import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { ConversationMemberGuard } from './conversation-member.guard.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { InviteLinksController } from './invite-links.controller.js';

@Module({
  imports: [MediaModule],
  controllers: [ConversationsController, InviteLinksController],
  providers: [ConversationsService, ConversationMemberGuard],
})
export class ConversationsModule {}
