import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  password?: string;
}
