import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { ConversationMemberGuard } from '../conversations/conversation-member.guard.js';
import {
  Membership,
  type ConversationMembership,
} from '../conversations/decorators/membership.decorator.js';
import { CallsService } from './calls.service.js';
import { StartCallDto } from './dto/start-call.dto.js';

@Controller()
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post('conversations/:id/calls')
  @UseGuards(ConversationMemberGuard)
  start(
    @Membership() membership: ConversationMembership,
    @Body() dto: StartCallDto,
  ) {
    return this.calls.startCall(
      membership.conversationId,
      membership.userId,
      dto.type,
    );
  }

  @Get('calls/:id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calls.getCall(id, user.id);
  }

  @Post('calls/:id/join')
  @HttpCode(HttpStatus.OK)
  join(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calls.joinCall(id, user.id);
  }

  @Post('calls/:id/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async decline(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.calls.declineCall(id, user.id);
  }

  @Post('calls/:id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.calls.leaveCall(id, user.id);
  }
}
