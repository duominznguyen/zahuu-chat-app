import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { MediaModule } from '../media/media.module.js';
import { ConversationMemberGuard } from './conversation-member.guard.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { InviteLinksController } from './invite-links.controller.js';

@Module({
  imports: [MediaModule, ChatModule],
  controllers: [ConversationsController, InviteLinksController],
  providers: [ConversationsService, ConversationMemberGuard],
  // Export guard để module Messages dùng lại cho /conversations/:id/messages, /conversations/:id/read
  exports: [ConversationMemberGuard],
})
export class ConversationsModule {}
