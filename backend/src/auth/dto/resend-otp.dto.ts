import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { normalizeEmail } from './transforms.js';

export class ResendOtpDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;
}
