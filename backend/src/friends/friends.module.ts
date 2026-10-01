import { Module } from '@nestjs/common';
import { BlocksController } from './blocks.controller.js';
import { FriendRequestsController } from './friend-requests.controller.js';
import { FriendsController } from './friends.controller.js';
import { FriendsService } from './friends.service.js';

@Module({
  controllers: [FriendRequestsController, FriendsController, BlocksController],
  providers: [FriendsService],
})
export class FriendsModule {}
