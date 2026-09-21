import { Transform } from 'class-transformer';
import { IsEmail, Matches } from 'class-validator';
import { normalizeEmail } from './transforms.js';

export class VerifyEmailDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/, { message: 'Mã OTP gồm 6 chữ số' })
  otp!: string;
}
