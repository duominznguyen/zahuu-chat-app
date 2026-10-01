import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConversationMemberGuard } from '../conversations/conversation-member.guard.js';
import {
  Membership,
  type ConversationMembership,
} from '../conversations/decorators/membership.decorator.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';
import { MarkReadDto } from './dto/mark-read.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { MessagesService } from './messages.service.js';

@UseGuards(ConversationMemberGuard)
@Controller('conversations')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get(':id/messages')
  list(
    @Membership() membership: ConversationMembership,
    @Query() dto: ListMessagesDto,
  ) {
    return this.messagesService.listMessages(membership, dto);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post(':id/messages')
  send(
    @Membership() membership: ConversationMembership,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(membership, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':id/read')
  markRead(
    @Membership() membership: ConversationMembership,
    @Body() dto: MarkReadDto,
  ) {
    return this.messagesService.markRead(membership, dto.lastReadMessageId);
  }
}
