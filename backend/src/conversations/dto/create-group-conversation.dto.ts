import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGroupConversationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}
