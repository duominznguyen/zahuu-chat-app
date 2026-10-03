import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatGateway } from './chat.gateway.js';
import { PresenceService } from './presence.service.js';

@Module({
  imports: [AuthModule],
  providers: [ChatGateway, PresenceService],
  // Export để ConversationsService dùng tra trạng thái online ban đầu (GET
  // /conversations, GET /conversations/:id) — socket chỉ báo được lúc CHUYỂN
  // trạng thái, không có cách nào biết trạng thái hiện tại lúc mới fetch trang.
  exports: [PresenceService],
})
export class ChatModule {}
