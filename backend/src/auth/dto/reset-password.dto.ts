import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeEmail } from './transforms.js';

export class ResetPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/, { message: 'Mã OTP gồm 6 chữ số' })
  otp!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  newPassword!: string;
}
