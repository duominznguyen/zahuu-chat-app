import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { DevicePlatform } from '../../generated/prisma/enums.js';

export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fcmToken!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;
}
