import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { MediaModule } from '../media/media.module.js';
import { MessageActionsController } from './message-actions.controller.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [ConversationsModule, MediaModule],
  controllers: [MessagesController, MessageActionsController],
  providers: [MessagesService],
})
export class MessagesModule {}
