import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { SetReactionDto } from './dto/set-reaction.dto.js';
import { MessagesService } from './messages.service.js';

// Route theo messageId, không có conversationId trong URL nên không qua được
// ConversationMemberGuard — MessagesService tự kiểm tra quyền thành viên.
@Controller('messages')
export class MessageActionsController {
  constructor(private readonly messagesService: MessagesService) {}

  @Patch(':id/recall')
  recall(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messagesService.recallMessage(user.id, id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  deleteForMe(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messagesService.deleteForMe(user.id, id);
  }

  @Put(':id/reactions')
  setReaction(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetReactionDto,
  ) {
    return this.messagesService.setReaction(user.id, id, dto.reactionType);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/reactions')
  removeReaction(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messagesService.removeReaction(user.id, id);
  }
}
