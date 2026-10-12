import { IsUUID } from 'class-validator';

export class AroundMessageDto {
  @IsUUID()
  messageId!: string;
}
