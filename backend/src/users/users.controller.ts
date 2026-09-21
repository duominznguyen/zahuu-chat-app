import {
  Body,
  Controller,
  Get,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  Param, ParseUUIDPipe
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';
import { ChangeUsernameDto } from './dto/change-username.dto.js';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../auth/auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { DeactivateAccountDto } from './dto/deactivate-account.dto.js';
import { SearchUsersDto } from './dto/search-users.dto.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.getMe(user.id);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query() dto: SearchUsersDto) {
    return this.usersService.search(user.id, dto.q);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Patch('me/username')
  changeUsername(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeUsernameDto,
  ) {
    return this.usersService.changeUsername(user.id, dto);
  }
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Patch('me/password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('me')
  deactivate(@CurrentUser() user: AuthUser, @Body() dto: DeactivateAccountDto) {
    return this.authService.deactivateAccount(user.id, dto);
  }
  
  @Get(':id')
  getProfile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.getProfile(user.id, id.toLowerCase());
  }
}
