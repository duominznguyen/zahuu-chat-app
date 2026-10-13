import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListMessagesDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  // Lấy các tin MỚI HƠN tin này (thay vì cũ hơn như `cursor`) — để tải tiếp
  // về phía tin mới sau khi nhảy tới 1 tin cũ qua /messages/around.
  @IsOptional()
  @IsUUID()
  after?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
