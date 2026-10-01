import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { ListFriendsDto } from './dto/list-friends.dto.js';
import { SearchFriendsDto } from './dto/search-friends.dto.js';
import { FriendsService } from './friends.service.js';

@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() dto: ListFriendsDto) {
    return this.friendsService.listFriends(user.id, dto.cursor, dto.limit);
  }

  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query() dto: SearchFriendsDto) {
    return this.friendsService.searchFriends(user.id, dto.q);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':userId')
  unfriend(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.friendsService.unfriend(user.id, userId);
  }
}
