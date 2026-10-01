import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { assertCallerActive } from '../common/assert-caller-active.js';
import { escapeLike } from '../common/escape-like.js';
import { orderedPair } from '../common/ordered-pair.js';
import { FriendRequestStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const FRIEND_REQUESTS_LIST_LIMIT = 100;
const FRIENDS_LIST_DEFAULT_LIMIT = 30;
const FRIENDS_SEARCH_LIMIT = 50;

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new ConflictException({
        statusCode: 409,
        code: 'SELF_REQUEST',
        message: 'Không thể gửi lời mời cho chính mình',
      });
    }

    await assertCallerActive(this.prisma, senderId);

    const notFound = () => new NotFoundException('Không tìm thấy người dùng');

    const [receiver, blocks] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: receiverId },
        select: { deactivatedAt: true },
      }),
      this.prisma.block.findMany({
        where: {
          OR: [
            { blockerId: senderId, blockedId: receiverId },
            { blockerId: receiverId, blockedId: senderId },
          ],
        },
        select: { blockerId: true },
      }),
    ]);

    if (!receiver || receiver.deactivatedAt) throw notFound();
    if (blocks.some((b) => b.blockerId === receiverId)) throw notFound();
    if (blocks.some((b) => b.blockerId === senderId)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'BLOCKED_BY_YOU',
        message: 'Bạn đã chặn người này, hãy bỏ chặn trước khi kết bạn',
      });
    }

    const friendship = await this.prisma.friendship.findUnique({
      where: { userId1_userId2: orderedPair(senderId, receiverId) },
      select: { id: true },
    });
    if (friendship) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ALREADY_FRIENDS',
        message: 'Hai người đã là bạn bè',
      });
    }

    const [outgoing, incoming] = await Promise.all([
      this.prisma.friendRequest.findUnique({
        where: { senderId_receiverId: { senderId, receiverId } },
      }),
      this.prisma.friendRequest.findUnique({
        where: {
          senderId_receiverId: { senderId: receiverId, receiverId: senderId },
        },
      }),
    ]);

    if (outgoing?.status === FriendRequestStatus.PENDING) {
      throw new ConflictException({
        statusCode: 409,
        code: 'REQUEST_ALREADY_SENT',
        message: 'Bạn đã gửi lời mời cho người này rồi',
      });
    }

    if (incoming?.status === FriendRequestStatus.PENDING) {
      await this.acceptExisting(
        incoming.id,
        incoming.senderId,
        incoming.receiverId,
      );
      return { status: 'accepted' as const };
    }

    const request = await this.prisma.friendRequest.upsert({
      where: { senderId_receiverId: { senderId, receiverId } },
      create: { senderId, receiverId },
      update: { status: FriendRequestStatus.PENDING, respondedAt: null },
      select: { id: true, createdAt: true },
    });
    this.events.emit('friend.request.received', {
      receiverId,
      request: { id: request.id, senderId, createdAt: request.createdAt },
    });

    return { status: 'pending' as const, requestId: request.id };
  }

  async listRequests(userId: string, type: 'received' | 'sent') {
    if (type === 'received') {
      const requests = await this.prisma.friendRequest.findMany({
        where: { receiverId: userId, status: FriendRequestStatus.PENDING },
        select: {
          id: true,
          createdAt: true,
          sender: { select: publicUserSelect },
        },
        orderBy: { createdAt: 'desc' },
        take: FRIEND_REQUESTS_LIST_LIMIT,
      });
      return requests.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.sender,
      }));
    }

    const requests = await this.prisma.friendRequest.findMany({
      where: { senderId: userId, status: FriendRequestStatus.PENDING },
      select: {
        id: true,
        createdAt: true,
        receiver: { select: publicUserSelect },
      },
      orderBy: { createdAt: 'desc' },
      take: FRIEND_REQUESTS_LIST_LIMIT,
    });
    return requests.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      user: r.receiver,
    }));
  }

  async respondToRequest(
    userId: string,
    requestId: string,
    action: 'accept' | 'reject',
  ) {
    await assertCallerActive(this.prisma, userId);

    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.status !== FriendRequestStatus.PENDING) {
      throw new NotFoundException('Không tìm thấy lời mời hoặc đã được xử lý');
    }
    // Chỉ người NHẬN được accept/reject
    if (request.receiverId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác với lời mời này',
      );
    }

    if (action === 'reject') {
      await this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: FriendRequestStatus.REJECTED, respondedAt: new Date() },
      });
      return { status: 'rejected' as const };
    }

    await this.acceptExisting(request.id, request.senderId, request.receiverId);
    return { status: 'accepted' as const };
  }

  async cancelRequest(userId: string, requestId: string) {
    await assertCallerActive(this.prisma, userId);

    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.status !== FriendRequestStatus.PENDING) {
      throw new NotFoundException('Không tìm thấy lời mời hoặc đã được xử lý');
    }
    // Chỉ người GỬI được hủy lời mời của chính mình
    if (request.senderId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác với lời mời này',
      );
    }

    await this.prisma.friendRequest.delete({ where: { id: requestId } });
  }

  async listFriends(userId: string, cursor?: string, limit?: number) {
    const take = limit ?? FRIENDS_LIST_DEFAULT_LIMIT;

    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userId1: userId }, { userId2: userId }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        userId1: true,
        user1: { select: publicUserSelect },
        user2: { select: publicUserSelect },
      },
    });

    const hasMore = friendships.length > take;
    const page = friendships.slice(0, take);
    const items = page.map((f) => ({
      friendshipId: f.id,
      since: f.createdAt,
      user: f.userId1 === userId ? f.user2 : f.user1,
    }));

    return {
      items,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async searchFriends(userId: string, q: string) {
    const needle = escapeLike(q);

    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { userId1: userId, user2: { displayName: { contains: needle } } },
          { userId2: userId, user1: { displayName: { contains: needle } } },
        ],
      },
      select: {
        userId1: true,
        user1: { select: publicUserSelect },
        user2: { select: publicUserSelect },
      },
      take: FRIENDS_SEARCH_LIMIT,
    });

    return friendships.map((f) => (f.userId1 === userId ? f.user2 : f.user1));
  }

  async unfriend(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException('Không thể hủy kết bạn với chính mình');
    }

    const { count } = await this.prisma.friendship.deleteMany({
      where: orderedPair(userId, otherUserId),
    });
    if (count === 0) {
      throw new NotFoundException('Hai người hiện không phải là bạn bè');
    }
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('Không thể tự chặn chính mình');
    }
    await assertCallerActive(this.prisma, blockerId);

    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');

    const existing = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    if (existing) return; // đã chặn rồi -> idempotent, không báo lỗi

    await this.prisma.$transaction([
      this.prisma.block.create({ data: { blockerId, blockedId } }),
      this.prisma.friendship.deleteMany({
        where: orderedPair(blockerId, blockedId),
      }),
      this.prisma.friendRequest.deleteMany({
        where: {
          status: FriendRequestStatus.PENDING,
          OR: [
            { senderId: blockerId, receiverId: blockedId },
            { senderId: blockedId, receiverId: blockerId },
          ],
        },
      }),
    ]);
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await assertCallerActive(this.prisma, blockerId);
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
  }

  async listBlocked(blockerId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId },
      select: { createdAt: true, blocked: { select: publicUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return blocks.map((b) => ({ ...b.blocked, blockedAt: b.createdAt }));
  }

  private async acceptExisting(
    requestId: string,
    senderId: string,
    receiverId: string,
  ) {
    await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: FriendRequestStatus.ACCEPTED, respondedAt: new Date() },
      }),
      this.prisma.friendship.create({
        data: orderedPair(senderId, receiverId),
      }),
    ]);
    // báo cho cả 2 phía, vì request có thể auto-accept từ phía người gửi
    this.events.emit('friend.accepted', {
      userId: senderId,
      otherUserId: receiverId,
    });
    this.events.emit('friend.accepted', {
      userId: receiverId,
      otherUserId: senderId,
    });
  }
}
