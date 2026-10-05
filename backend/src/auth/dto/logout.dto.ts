import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LogoutDto {
  // Web gửi qua cookie (path /auth), không qua body — xem AuthController.logout.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fcmToken?: string;
}
