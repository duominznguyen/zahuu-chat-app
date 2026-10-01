import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto.js';
import { NotificationsService } from './notifications.service.js';

@Controller('device-tokens')
export class DeviceTokensController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post()
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceTokenDto) {
    return this.notificationsService.registerDeviceToken(
      user.id,
      dto.fcmToken,
      dto.platform,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.removeDeviceToken(user.id, id);
  }
}
