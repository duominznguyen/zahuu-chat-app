import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const MAX_GROUP_MEMBERS = 250;

export class CreateGroupConversationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GROUP_MEMBERS)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}
