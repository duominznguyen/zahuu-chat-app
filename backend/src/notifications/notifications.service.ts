import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import { NotificationType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FCM_SEND_QUEUE, type FcmSendJob } from './fcm-send.queue.js';

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const LIST_DEFAULT_LIMIT = 30;

interface FriendRequestReceivedEvent {
  receiverId: string;
  request: { id: string; senderId: string; createdAt: Date };
}
interface FriendAcceptedEvent {
  userId: string;
  otherUserId: string;
}
interface GroupMemberAddedEvent {
  conversationId: string;
  member: { id: string };
  addedById: string | null;
  notify: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(FCM_SEND_QUEUE) private readonly fcmQueue: Queue<FcmSendJob>,
  ) {}

  @OnEvent('friend.request.received')
  async onFriendRequestReceived({
    receiverId,
    request,
  }: FriendRequestReceivedEvent) {
    await this.notify(
      receiverId,
      NotificationType.FRIEND_REQUEST_RECEIVED,
      request.senderId,
      null,
    );
  }

  @OnEvent('friend.accepted')
  async onFriendAccepted({ userId, otherUserId }: FriendAcceptedEvent) {
    await this.notify(
      userId,
      NotificationType.FRIEND_REQUEST_ACCEPTED,
      otherUserId,
      null,
    );
  }

  @OnEvent('group.member.added')
  async onGroupMemberAdded({
    conversationId,
    member,
    addedById,
    notify,
  }: GroupMemberAddedEvent) {
    if (!notify) return;
    await this.notify(
      member.id,
      NotificationType.GROUP_MEMBER_ADDED,
      addedById,
      conversationId,
    );
  }

  async listNotifications(userId: string, cursor?: string, limit?: number) {
    const take = limit ?? LIST_DEFAULT_LIMIT;

    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { actor: { select: publicUserSelect } },
    });

    const hasMore = notifications.length > take;
    const page = notifications.slice(0, take);
    const items = page.map((n) => ({
      id: n.id,
      type: n.type,
      actor: n.actor,
      conversationId: n.conversationId,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));
    return { items, nextCursor: hasMore ? page[page.length - 1].id : null };
  }

  async markRead(userId: string, notificationId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
  }

  async registerDeviceToken(
    userId: string,
    fcmToken: string,
    platform: string,
  ) {
    await this.prisma.deviceToken.upsert({
      where: { fcmToken },
      // Máy dùng chung nhiều tài khoản: token cũ phải gán lại cho user hiện tại,
      // không thì push vẫn chạy tới chủ cũ.
      create: { userId, fcmToken, platform: platform as never },
      update: { userId, platform: platform as never },
    });
  }

  async removeDeviceToken(userId: string, deviceTokenId: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { id: deviceTokenId, userId },
    });
  }

  private async notify(
    userId: string,
    type: NotificationType,
    actorId: string | null,
    conversationId: string | null,
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, actorId, conversationId },
    });

    const { title, body } = await this.buildPushText(type, actorId);
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { id: true, fcmToken: true },
    });
    for (const device of devices) {
      await this.fcmQueue.add(
        'send',
        {
          deviceTokenId: device.id,
          fcmToken: device.fcmToken,
          title,
          body,
          data: { notificationId: notification.id, type },
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );
    }
  }

  private async buildPushText(type: NotificationType, actorId: string | null) {
    const actorName = actorId
      ? ((
          await this.prisma.user.findUnique({
            where: { id: actorId },
            select: { displayName: true },
          })
        )?.displayName ?? 'Ai đó')
      : 'Ai đó';

    switch (type) {
      case NotificationType.FRIEND_REQUEST_RECEIVED:
        return {
          title: 'Lời mời kết bạn',
          body: `${actorName} đã gửi lời mời kết bạn cho bạn`,
        };
      case NotificationType.FRIEND_REQUEST_ACCEPTED:
        return {
          title: 'Lời mời được chấp nhận',
          body: `${actorName} đã chấp nhận lời mời kết bạn`,
        };
      case NotificationType.GROUP_MEMBER_ADDED:
        return {
          title: 'Thêm vào nhóm',
          body: `${actorName} đã thêm bạn vào một nhóm`,
        };
    }
  }
}
