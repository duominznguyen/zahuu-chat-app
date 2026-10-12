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
import { AroundMessageDto } from './dto/around-message.dto.js';
import { ListMediaDto } from './dto/list-media.dto.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';
import { SearchMessagesDto } from './dto/search-messages.dto.js';
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

  @Get(':id/messages/search')
  search(
    @Membership() membership: ConversationMembership,
    @Query() dto: SearchMessagesDto,
  ) {
    return this.messagesService.searchMessages(membership, dto);
  }

  @Get(':id/messages/around')
  around(
    @Membership() membership: ConversationMembership,
    @Query() dto: AroundMessageDto,
  ) {
    return this.messagesService.aroundMessage(membership, dto.messageId);
  }

  @Get(':id/media')
  media(
    @Membership() membership: ConversationMembership,
    @Query() dto: ListMediaDto,
  ) {
    return this.messagesService.listMediaMessages(membership, dto);
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
