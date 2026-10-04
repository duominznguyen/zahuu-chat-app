import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  // Web gửi qua cookie (path /auth), không qua body — xem AuthController.refresh.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken?: string;
}
