import { IsIn } from 'class-validator';

export class ListFriendRequestsDto {
  @IsIn(['received', 'sent'])
  type!: 'received' | 'sent';
}
