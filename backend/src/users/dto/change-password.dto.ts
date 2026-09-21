import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  newPassword!: string;
}
