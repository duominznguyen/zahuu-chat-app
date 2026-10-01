import { Transform } from 'class-transformer';
import { IsOptional, IsUrl } from 'class-validator';

export class UpdateBackgroundDto {
  // url lấy từ POST /media/upload (purpose=BACKGROUND); null để trả về mặc định
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUrl({ require_protocol: true })
  url?: string | null;
}
