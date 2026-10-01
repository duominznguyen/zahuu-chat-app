import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MessageType } from '../../generated/prisma/enums.js';

const MEDIA_TYPES: MessageType[] = [
  MessageType.IMAGE,
  MessageType.VIDEO,
  MessageType.FILE,
];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // khớp MEDIA_MAX_FILE_MB mặc định ở module Media

export class SendMessageDto {
  @IsEnum(MessageType)
  type!: MessageType;

  // TEXT: nội dung text. STICKER: mã sticker.
  @ValidateIf(
    (o: SendMessageDto) =>
      o.type === MessageType.TEXT || o.type === MessageType.STICKER,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content?: string;

  // Bắt buộc với IMAGE/VIDEO/FILE, lấy từ POST /media/upload (purpose=MESSAGE)
  @ValidateIf((o: SendMessageDto) => MEDIA_TYPES.includes(o.type))
  @IsUrl({ require_protocol: true })
  mediaUrl?: string;

  @ValidateIf((o: SendMessageDto) => MEDIA_TYPES.includes(o.type))
  @IsString()
  @IsNotEmpty()
  mediaPublicId?: string;

  // Chỉ có ý nghĩa với FILE (hiển thị tên/dung lượng)
  @ValidateIf((o: SendMessageDto) => o.type === MessageType.FILE)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mediaName?: string;

  @ValidateIf((o: SendMessageDto) => o.type === MessageType.FILE)
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_BYTES)
  mediaSize?: number;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
