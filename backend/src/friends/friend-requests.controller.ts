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
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { ListFriendRequestsDto } from './dto/list-friend-requests.dto.js';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto.js';
import { SendFriendRequestDto } from './dto/send-friend-request.dto.js';
import { FriendsService } from './friends.service.js';

@Controller('friend-requests')
export class FriendRequestsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  send(@CurrentUser() user: AuthUser, @Body() dto: SendFriendRequestDto) {
    return this.friendsService.sendRequest(user.id, dto.receiverId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() dto: ListFriendRequestsDto) {
    return this.friendsService.listRequests(user.id, dto.type);
  }

  @Patch(':id')
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondFriendRequestDto,
  ) {
    return this.friendsService.respondToRequest(user.id, id, dto.action);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.friendsService.cancelRequest(user.id, id);
  }
}
