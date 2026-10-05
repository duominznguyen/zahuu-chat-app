import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { CallsController } from './calls.controller.js';
import { CallsService } from './calls.service.js';
import { CallsWebhookController } from './calls-webhook.controller.js';
import { LivekitService } from './livekit.service.js';

@Module({
  imports: [ConversationsModule],
  controllers: [CallsController, CallsWebhookController],
  providers: [CallsService, LivekitService],
})
export class CallsModule {}
