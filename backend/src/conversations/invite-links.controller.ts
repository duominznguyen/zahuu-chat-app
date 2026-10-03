import { Controller, Get, Param, Post } from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { ConversationsService } from './conversations.service.js';

@Controller('invite-links')
export class InviteLinksController {
  constructor(private readonly conversationsService: ConversationsService) {}

  // Xem trước nhóm trước khi join (màn xác nhận) — không cần là bạn bè ai,
  // không cần đã là thành viên.
  @Get(':token')
  preview(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.conversationsService.previewInviteLink(user.id, token);
  }

  // Join bằng link mời không cần là bạn bè ai — ngoại lệ có chủ đích
  @Post(':token/join')
  join(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.conversationsService.joinByToken(user.id, token);
  }
}
