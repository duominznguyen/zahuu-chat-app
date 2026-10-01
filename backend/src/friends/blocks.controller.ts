import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { BlockUserDto } from './dto/block-user.dto.js';
import { FriendsService } from './friends.service.js';

@Controller('blocks')
export class BlocksController {
  constructor(private readonly friendsService: FriendsService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post()
  block(@CurrentUser() user: AuthUser, @Body() dto: BlockUserDto) {
    return this.friendsService.blockUser(user.id, dto.userId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':userId')
  unblock(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.friendsService.unblockUser(user.id, userId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.friendsService.listBlocked(user.id);
  }
}
