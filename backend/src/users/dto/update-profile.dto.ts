import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Gender } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProfileDto {
  @ValidateIf((o: UpdateProfileDto) => o.displayName !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayName?: string;

  // Được gửi null để xóa
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  bio?: string | null;

  @IsOptional()
  @IsISO8601()
  birthday?: string | null;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender | null;

  @IsOptional()
  @Transform(trim)
  @IsUrl({ require_protocol: true })
  avatarUrl?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsUrl({ require_protocol: true })
  coverUrl?: string | null;
}
