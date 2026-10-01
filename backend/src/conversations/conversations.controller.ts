import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import type { MemberRole } from '../generated/prisma/enums.js';
import { ConversationMemberGuard } from './conversation-member.guard.js';
import { ConversationsService } from './conversations.service.js';
import { Membership } from './decorators/membership.decorator.js';
import type { ConversationMembership } from './decorators/membership.decorator.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto.js';
import { CreateGroupConversationDto } from './dto/create-group-conversation.dto.js';
import { ListConversationsDto } from './dto/list-conversations.dto.js';
import { SetNicknameDto } from './dto/set-nickname.dto.js';
import { UpdateBackgroundDto } from './dto/update-background.dto.js';
import { UpdateConversationDto } from './dto/update-conversation.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() dto: ListConversationsDto) {
    return this.conversationsService.listConversations(
      user.id,
      dto.cursor,
      dto.limit,
    );
  }

  @Post('direct')
  createDirect(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDirectConversationDto,
  ) {
    return this.conversationsService.createDirect(user.id, dto.friendId);
  }

  @Post('group')
  createGroup(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGroupConversationDto,
  ) {
    return this.conversationsService.createGroup(
      user.id,
      dto.name,
      dto.memberIds,
    );
  }

  @UseGuards(ConversationMemberGuard)
  @Get(':id')
  getDetail(
    @Membership() membership: ConversationMembership,
    @CurrentUser() user: AuthUser,
  ) {
    return this.conversationsService.getConversationDetail(
      membership.conversationId,
      user.id,
    );
  }

  @UseGuards(ConversationMemberGuard)
  @Patch(':id')
  update(
    @Membership() membership: ConversationMembership,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationsService.updateConversation(membership, dto);
  }

  @UseGuards(ConversationMemberGuard)
  @Patch(':id/background')
  updateBackground(
    @Membership() membership: ConversationMembership,
    @Body() dto: UpdateBackgroundDto,
  ) {
    return this.conversationsService.updateBackground(membership, dto);
  }

  @UseGuards(ConversationMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/leave')
  leave(@Membership() membership: ConversationMembership) {
    return this.conversationsService.leaveConversation(membership);
  }

  @UseGuards(ConversationMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  disband(@Membership() membership: ConversationMembership) {
    return this.conversationsService.disbandConversation(membership);
  }

  @UseGuards(ConversationMemberGuard)
  @Post(':id/members')
  addMember(
    @Membership() membership: ConversationMembership,
    @Body() dto: AddMemberDto,
  ) {
    return this.conversationsService.addMember(membership, dto.userId);
  }

  @UseGuards(ConversationMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/members/:userId')
  removeMember(
    @Membership() membership: ConversationMembership,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.conversationsService.removeMember(membership, userId);
  }

  @UseGuards(ConversationMemberGuard)
  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @Membership() membership: ConversationMembership,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.conversationsService.updateMemberRole(
      membership,
      userId,
      dto.role as MemberRole,
    );
  }

  @UseGuards(ConversationMemberGuard)
  @Put(':id/nicknames/:targetUserId')
  setNickname(
    @Membership() membership: ConversationMembership,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: SetNicknameDto,
  ) {
    return this.conversationsService.setNickname(
      membership,
      targetUserId,
      dto.nickname,
    );
  }

  @UseGuards(ConversationMemberGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post(':id/invite-links')
  createInviteLink(@Membership() membership: ConversationMembership) {
    return this.conversationsService.createInviteLink(membership);
  }

  @UseGuards(ConversationMemberGuard)
  @Get(':id/invite-links')
  listInviteLinks(@Membership() membership: ConversationMembership) {
    return this.conversationsService.listInviteLinks(membership);
  }

  @UseGuards(ConversationMemberGuard)
  @Patch(':id/invite-links/:linkId/revoke')
  revokeInviteLink(
    @Membership() membership: ConversationMembership,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.conversationsService.revokeInviteLink(membership, linkId);
  }
}
