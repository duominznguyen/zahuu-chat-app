import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatGateway } from './chat.gateway.js';
import { PresenceService } from './presence.service.js';

@Module({
  imports: [AuthModule],
  providers: [ChatGateway, PresenceService],
})
export class ChatModule {}
