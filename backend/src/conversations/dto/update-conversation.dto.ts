import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateConversationDto {
  // Không dùng @IsOptional: tên nhóm không được phép xóa về null
  @ValidateIf((o: UpdateConversationDto) => o.name !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  // url lấy từ POST /media/upload (purpose=GROUP_AVATAR); null để xóa avatar
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUrl({ require_protocol: true })
  avatarUrl?: string | null;
}
