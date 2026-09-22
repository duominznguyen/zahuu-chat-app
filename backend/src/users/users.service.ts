import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  NotFoundException 
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChangeUsernameDto } from './dto/change-username.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { RESERVED_USERNAMES } from './reserved-usernames.js';
import { escapeLike } from '../common/escape-like.js';
import { FriendRequestStatus } from '../generated/prisma/enums.js';
import { MediaPurpose } from '../media/media-purpose.enum.js';
import { MediaService } from '../media/media.service.js';



type RelationshipStatus =
  | 'self'
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'friends'
  | 'blocked';

const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  coverUrl: true,
  bio: true,
  birthday: true,
  gender: true,
  deactivatedAt: true,
} as const;

const meSelect = {
  id: true,
  username: true,
  usernameChangedAt: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  coverUrl: true,
  bio: true,
  birthday: true,
  gender: true,
  createdAt: true,
  deactivatedAt: true,
  passwordHash: true,
  authProviders: { select: { provider: true } },
} as const;

const SEARCH_LIMIT = 10;


@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly media: MediaService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: meSelect,
    });
    return this.toMe(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (dto.birthday) this.assertValidBirthday(dto.birthday);
    if (dto.avatarUrl) this.media.assertOwnedMedia(userId, MediaPurpose.AVATAR, dto.avatarUrl);
    if (dto.coverUrl) this.media.assertOwnedMedia(userId, MediaPurpose.COVER, dto.coverUrl);

    await this.getMe(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        birthday: dto.birthday ? new Date(dto.birthday) : dto.birthday,
        gender: dto.gender,
        avatarUrl: dto.avatarUrl,
        coverUrl: dto.coverUrl,
      },
      select: meSelect,
    });
    return this.toMe(user);
  }


  async search(userId: string, q: string) {
    return this.prisma.user.findMany({
      where: {
        username: { startsWith: escapeLike(q) },
        deactivatedAt: null,
        id: { not: userId },
        blocksInitiated: { none: { blockedId: userId } },
      },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
      orderBy: { username: 'asc' },
      take: SEARCH_LIMIT,
    });
  }

  async getProfile(viewerId: string, targetId: string) {
    const notFound = () => new NotFoundException('Không tìm thấy người dùng');

    const [target, blocks, friendship, requests] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: targetId },
        select: profileSelect,
      }),
      this.prisma.block.findMany({
        where: {
          OR: [
            { blockerId: viewerId, blockedId: targetId },
            { blockerId: targetId, blockedId: viewerId },
          ],
        },
        select: { blockerId: true },
      }),
      this.prisma.friendship.findUnique({
        where: { userId1_userId2: this.orderedPair(viewerId, targetId) },
        select: { id: true },
      }),
      this.prisma.friendRequest.findMany({
        where: {
          status: FriendRequestStatus.PENDING,
          OR: [
            { senderId: viewerId, receiverId: targetId },
            { senderId: targetId, receiverId: viewerId },
          ],
        },
        select: { senderId: true },
      }),
    ]);

    if (!target || target.deactivatedAt) throw notFound();
    if (blocks.some((b) => b.blockerId === targetId)) throw notFound();

    let status: RelationshipStatus;
    if (viewerId === targetId) status = 'self';
    else if (blocks.length > 0) status = 'blocked';
    else if (friendship) status = 'friends';
    else if (requests.some((r) => r.senderId === targetId)) status = 'pending_received';
    else if (requests.length > 0) status = 'pending_sent';
    else status = 'none';

    const { deactivatedAt, birthday, gender, ...publicFields } = target;
    const canSeePrivate = status === 'self' || status === 'friends';

    return {
      ...publicFields,
      ...(canSeePrivate && { birthday, gender }),
      relationshipStatus: status,
    };
  }


  private orderedPair(a: string, b: string) {
    return a < b ? { userId1: a, userId2: b } : { userId1: b, userId2: a };
  }


  private assertValidBirthday(value: string) {
    const date = new Date(value);
    if (date > new Date() || date.getUTCFullYear() < 1900) {
      throw new BadRequestException('Ngày sinh không hợp lệ');
    }
  }

  private toMe(user: Awaited<ReturnType<UsersService['findRaw']>>) {
    if (!user || user.deactivatedAt) {
      throw new UnauthorizedException('Tài khoản không khả dụng');
    }
    const {
      passwordHash,
      authProviders,
      deactivatedAt,
      usernameChangedAt,
      ...profile
    } = user;
    return {
      ...profile,
      hasPassword: passwordHash !== null,
      providers: authProviders.map((p) => p.provider),
      usernameChangeAvailableAt:
        this.usernameChangeAvailableAt(usernameChangedAt),
    };
  }

  private findRaw(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: meSelect,
    });
  }
  async changeUsername(userId: string, dto: ChangeUsernameDto) {
    const { username } = dto;
    if (RESERVED_USERNAMES.has(username)) {
      throw new BadRequestException('Username này không được phép sử dụng');
    }

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, usernameChangedAt: true, deactivatedAt: true },
    });
    if (!current || current.deactivatedAt) {
      throw new UnauthorizedException('Tài khoản không khả dụng');
    }
    if (current.username === username) {
      throw new BadRequestException('Username mới trùng với username hiện tại');
    }

    const availableAt = this.usernameChangeAvailableAt(
      current.usernameChangedAt,
    );
    if (availableAt) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'USERNAME_COOLDOWN',
        message: 'Bạn chưa thể đổi username lúc này',
        availableAt,
      });
    }

    const taken = () =>
      new ConflictException({
        statusCode: 409,
        code: 'USERNAME_TAKEN',
        message: 'Username đã được sử dụng',
      });
    const existing = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existing) throw taken();

    let count: number;
    try {
      ({ count } = await this.prisma.user.updateMany({
        where: { id: userId, usernameChangedAt: current.usernameChangedAt },
        data: { username, usernameChangedAt: new Date() },
      }));
    } catch (e) {
      if (isUniqueViolation(e)) throw taken();
      throw e;
    }
    if (count === 0) {
      throw new ConflictException(
        'Yêu cầu đổi username bị xung đột, vui lòng thử lại',
      );
    }

    return this.getMe(userId);
  }

  private usernameChangeAvailableAt(changedAt: Date | null) {
    if (!changedAt) return null;
    const days = Number(this.config.get('USERNAME_CHANGE_COOLDOWN_DAYS') ?? 14);
    const availableAt = new Date(
      changedAt.getTime() + days * 24 * 60 * 60 * 1000,
    );
    return availableAt > new Date() ? availableAt : null;
  }
}
