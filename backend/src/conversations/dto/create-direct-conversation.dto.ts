import { IsUUID } from 'class-validator';

export class CreateDirectConversationDto {
  // Nhận cả người chưa kết bạn; giữ tên `friendId` để không phá client mobile đang dùng.
  @IsUUID()
  friendId!: string;
}
