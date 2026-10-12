import { IsEnum } from 'class-validator';
import { CallType } from '../../generated/prisma/enums.js';

export class StartCallDto {
  @IsEnum(CallType)
  type!: CallType;
}
