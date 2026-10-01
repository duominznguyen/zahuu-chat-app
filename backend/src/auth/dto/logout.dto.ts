import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fcmToken?: string;
}
