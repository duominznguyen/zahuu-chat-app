import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes } from 'node:crypto';
import { assertActiveUser } from '../common/assert-active-user.js';
import { assertCallerActive } from '../common/assert-caller-active.js';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { orderedPair } from '../common/ordered-pair.js';
import type { ConversationMembership } from './decorators/membership.decorator.js';
import {
  ConversationType,
  MemberRole,
  MessageType,
} from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { MediaPurpose } from '../media/media-purpose.enum.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateBackgroundDto } from './dto/update-background.dto.js';
import type { UpdateConversationDto } from './dto/update-conversation.dto.js';

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const LIST_DEFAULT_LIMIT = 30;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly events: EventEmitter2,
  ) {}

  async listConversations(userId: string, cursor?: string, limit?: number) {
    const take = limit ?? LIST_DEFAULT_LIMIT;

    const conversations = await this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        members: {
          select: {
            userId: true,
            role: true,
            lastReadMessageId: true,
            user: { select: publicUserSelect },
          },
        },
        lastMessage: {
          select: {
            id: true,
            type: true,
            content: true,
            isRecalled: true,
            senderId: true,
          },
        },
      },
    });

    const hasMore = conversations.length > take;
    const page = conversations.slice(0, take);

    // Gộp 1 query duy nhất lấy nickname cho mọi conversation DIRECT trong trang này, tránh N+1
    const directTargets = page
      .filter((c) => c.type === ConversationType.DIRECT)
      .map((c) => ({
        conversationId: c.id,
        targetUserId: c.members.find((m) => m.userId !== userId)?.userId,
      }))
      .filter(
        (t): t is { conversationId: string; targetUserId: string } =>
          !!t.targetUserId,
      );

    const nicknames = directTargets.length
      ? await this.prisma.conversationNickname.findMany({
          where: { OR: directTargets },
          select: { conversationId: true, targetUserId: true, nickname: true },
        })
      : [];
    const nicknameMap = new Map(
      nicknames.map((n) => [
        `${n.conversationId}:${n.targetUserId}`,
        n.nickname,
      ]),
    );

    const items = page.map((c) => this.toSummary(c, userId, nicknameMap));
    return { items, nextCursor: hasMore ? page[page.length - 1].id : null };
  }

  async getConversationDetail(conversationId: string, viewerId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            lastReadMessageId: true,
            lastReadAt: true,
            user: { select: publicUserSelect },
          },
          orderBy: { joinedAt: 'asc' },
        },
        nicknames: { select: { targetUserId: true, nickname: true } },
      },
    });
    if (!conv) throw new NotFoundException('Không tìm thấy cuộc trò chuyện');

    const nicknameMap = new Map(
      conv.nicknames.map((n) => [n.targetUserId, n.nickname]),
    );
    const members = conv.members.map((m) => ({
      ...m.user,
      nickname: nicknameMap.get(m.userId) ?? null,
      role: m.role,
      joinedAt: m.joinedAt,
      lastReadMessageId: m.lastReadMessageId,
      lastReadAt: m.lastReadAt,
    }));
    const me = conv.members.find((m) => m.userId === viewerId);

    const base = {
      id: conv.id,
      type: conv.type,
      backgroundUrl: conv.backgroundUrl,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      role: me?.role ?? null,
      members,
    };

    if (conv.type === ConversationType.GROUP) {
      return { ...base, name: conv.name, avatarUrl: conv.avatarUrl };
    }
    const other = members.find((m) => m.id !== viewerId);
    return {
      ...base,
      name: other?.nickname ?? other?.displayName ?? null,
      avatarUrl: other?.avatarUrl ?? null,
    };
  }

  async createDirect(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new BadRequestException(
        'Không thể tạo cuộc trò chuyện với chính mình',
      );
    }
    await assertCallerActive(this.prisma, userId);
    await assertActiveUser(this.prisma, friendId);
    await this.assertFriends(userId, friendId);

    const pair = orderedPair(userId, friendId);
    const existing = await this.prisma.conversation.findUnique({
      where: { userId1_userId2: pair },
      select: { id: true },
    });
    if (existing) return this.getConversationDetail(existing.id, userId);

    try {
      const conv = await this.prisma.conversation.create({
        data: {
          type: ConversationType.DIRECT,
          ...pair,
          members: { create: [{ userId }, { userId: friendId }] },
        },
        select: { id: true },
      });
      await this.emitMembersAdded(conv.id, [userId, friendId], {
        addedById: userId,
        notifiable: false,
      });
      return this.getConversationDetail(conv.id, userId);
    } catch (e) {
      // 2 request tạo cùng lúc -> bên thua lấy lại dòng đã có, không báo lỗi
      if (isUniqueViolation(e)) {
        const conv = await this.prisma.conversation.findUniqueOrThrow({
          where: { userId1_userId2: pair },
          select: { id: true },
        });
        return this.getConversationDetail(conv.id, userId);
      }
      throw e;
    }
  }

  async createGroup(creatorId: string, name: string, memberIds: string[]) {
    await assertCallerActive(this.prisma, creatorId);
    if (memberIds.includes(creatorId)) {
      throw new BadRequestException('Không thể thêm chính mình vào memberIds');
    }

    const [users, friendships] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, deactivatedAt: true },
      }),
      this.prisma.friendship.findMany({
        where: { OR: memberIds.map((id) => orderedPair(creatorId, id)) },
        select: { userId1: true, userId2: true },
      }),
    ]);
    const activeUserIds = new Set(
      users.filter((u) => !u.deactivatedAt).map((u) => u.id),
    );
    const friendIds = new Set(
      friendships.map((f) => (f.userId1 === creatorId ? f.userId2 : f.userId1)),
    );
    for (const id of memberIds) {
      if (!activeUserIds.has(id)) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }
      if (!friendIds.has(id)) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'NOT_FRIENDS',
          message: 'Chỉ thêm được người đang là bạn bè',
        });
      }
    }

    const conv = await this.prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        name,
        members: {
          create: [
            { userId: creatorId, role: MemberRole.ADMIN },
            ...memberIds.map((userId) => ({ userId, role: MemberRole.MEMBER })),
          ],
        },
      },
      select: { id: true },
    });
    await this.emitMembersAdded(conv.id, [creatorId, ...memberIds], {
      addedById: creatorId,
      notifiable: true,
    });
    return this.getConversationDetail(conv.id, creatorId);
  }

  async updateConversation(
    membership: ConversationMembership,
    dto: UpdateConversationDto,
  ) {
    await this.assertGroup(membership.conversationId);
    this.assertAdmin(membership);
    if (dto.avatarUrl) {
      this.media.assertOwnedMedia(
        membership.userId,
        MediaPurpose.GROUP_AVATAR,
        dto.avatarUrl,
      );
    }

    await this.prisma.conversation.update({
      where: { id: membership.conversationId },
      data: { name: dto.name, avatarUrl: dto.avatarUrl },
    });
    this.events.emit('group.updated', {
      conversationId: membership.conversationId,
      changedFields: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });
    return this.getConversationDetail(
      membership.conversationId,
      membership.userId,
    );
  }

  async updateBackground(
    membership: ConversationMembership,
    dto: UpdateBackgroundDto,
  ) {
    if (dto.url) {
      this.media.assertOwnedMedia(
        membership.userId,
        MediaPurpose.BACKGROUND,
        dto.url,
      );
    }
    await this.prisma.conversation.update({
      where: { id: membership.conversationId },
      data: { backgroundUrl: dto.url },
    });
    this.events.emit('group.updated', {
      conversationId: membership.conversationId,
      changedFields: { backgroundUrl: dto.url },
    });
    return this.getConversationDetail(
      membership.conversationId,
      membership.userId,
    );
  }

  async leaveConversation(membership: ConversationMembership) {
    await this.assertGroup(membership.conversationId);

    const groupDeleted = await this.prisma.$transaction(async (tx) => {
      if (membership.role === MemberRole.ADMIN) {
        const canContinue = await this.promoteNextAdminIfNeeded(
          tx,
          membership.conversationId,
          membership.userId,
        );
        if (!canContinue) {
          // Không còn ai khác -> xóa hẳn nhóm (cascade xóa luôn membership này)
          await tx.conversation.delete({
            where: { id: membership.conversationId },
          });
          return true;
        }
      }
      await tx.conversationMember.delete({
        where: {
          conversationId_userId: {
            conversationId: membership.conversationId,
            userId: membership.userId,
          },
        },
      });
      return false;
    });

    // Nhóm đã bị xóa hẳn thì không còn room nào để báo
    if (!groupDeleted) {
      this.events.emit('group.member.removed', {
        conversationId: membership.conversationId,
        userId: membership.userId,
      });
    }
  }

  async disbandConversation(membership: ConversationMembership) {
    await this.assertGroup(membership.conversationId);
    this.assertAdmin(membership);
    await this.prisma.conversation.delete({
      where: { id: membership.conversationId },
    });
  }

  async addMember(membership: ConversationMembership, targetUserId: string) {
    await this.assertGroup(membership.conversationId);
    if (targetUserId === membership.userId) {
      throw new BadRequestException('Không thể tự thêm chính mình');
    }
    await assertActiveUser(this.prisma, targetUserId);
    await this.assertFriends(membership.userId, targetUserId);

    let member;
    try {
      member = await this.prisma.conversationMember.create({
        data: {
          conversationId: membership.conversationId,
          userId: targetUserId,
          role: MemberRole.MEMBER,
        },
        select: {
          role: true,
          joinedAt: true,
          user: { select: publicUserSelect },
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException({
          statusCode: 409,
          code: 'ALREADY_MEMBER',
          message: 'Người này đã là thành viên',
        });
      }
      throw e;
    }
    this.events.emit('group.member.added', {
      conversationId: membership.conversationId,
      member: { ...member.user, role: member.role, joinedAt: member.joinedAt },
      addedById: membership.userId,
      notify: true,
    });
    return this.getConversationDetail(
      membership.conversationId,
      membership.userId,
    );
  }

  async removeMember(membership: ConversationMembership, targetUserId: string) {
    await this.assertGroup(membership.conversationId);
    this.assertAdmin(membership);
    if (targetUserId === membership.userId) {
      throw new BadRequestException(
        'Hãy dùng chức năng rời nhóm cho chính mình',
      );
    }

    const { count } = await this.prisma.conversationMember.deleteMany({
      where: {
        conversationId: membership.conversationId,
        userId: targetUserId,
      },
    });
    if (count === 0) {
      throw new NotFoundException('Người này không phải thành viên');
    }
    this.events.emit('group.member.removed', {
      conversationId: membership.conversationId,
      userId: targetUserId,
    });
  }

  async updateMemberRole(
    membership: ConversationMembership,
    targetUserId: string,
    role: MemberRole,
  ) {
    await this.assertGroup(membership.conversationId);
    this.assertAdmin(membership);

    const target = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: membership.conversationId,
          userId: targetUserId,
        },
      },
    });
    if (!target) throw new NotFoundException('Người này không phải thành viên');
    if (target.role === role) return;

    await this.prisma.$transaction(async (tx) => {
      if (target.role === MemberRole.ADMIN && role === MemberRole.MEMBER) {
        const promoted = await this.promoteNextAdminIfNeeded(
          tx,
          membership.conversationId,
          targetUserId,
        );
        if (!promoted) {
          throw new ConflictException(
            'Không thể giáng chức admin duy nhất khi nhóm không còn thành viên nào khác',
          );
        }
      }
      await tx.conversationMember.update({
        where: { id: target.id },
        data: { role },
      });
    });
  }

  async setNickname(
    membership: ConversationMembership,
    targetUserId: string,
    nickname: string,
  ) {
    const target = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: membership.conversationId,
          userId: targetUserId,
        },
      },
    });
    if (!target) throw new NotFoundException('Người này không phải thành viên');

    await this.prisma.conversationNickname.upsert({
      where: {
        conversationId_targetUserId: {
          conversationId: membership.conversationId,
          targetUserId,
        },
      },
      create: {
        conversationId: membership.conversationId,
        targetUserId,
        nickname,
        setById: membership.userId,
      },
      update: { nickname, setById: membership.userId },
    });
    this.events.emit('group.updated', {
      conversationId: membership.conversationId,
      changedFields: { nickname: { targetUserId, nickname } },
    });
    return { targetUserId, nickname };
  }

  async createInviteLink(membership: ConversationMembership) {
    await this.assertGroup(membership.conversationId);
    this.assertAdmin(membership);

    const token = randomBytes(24).toString('base64url');
    const link = await this.prisma.groupInviteLink.create({
      data: {
        conversationId: membership.conversationId,
        token,
        createdById: membership.userId,
      },
      select: { id: true, token: true, createdAt: true },
    });
    return link;
  }

  async listInviteLinks(membership: ConversationMembership) {
    await this.assertGroup(membership.conversationId);
    this.assertAdmin(membership);
    return this.prisma.groupInviteLink.findMany({
      where: { conversationId: membership.conversationId, revoked: false },
      select: { id: true, token: true, createdById: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInviteLink(membership: ConversationMembership, linkId: string) {
    await this.assertGroup(membership.conversationId);
    this.assertAdmin(membership);
    const { count } = await this.prisma.groupInviteLink.updateMany({
      where: {
        id: linkId,
        conversationId: membership.conversationId,
        revoked: false,
      },
      data: { revoked: true },
    });
    if (count === 0) throw new NotFoundException('Không tìm thấy link mời');
  }

  async joinByToken(userId: string, token: string) {
    await assertCallerActive(this.prisma, userId);

    const link = await this.prisma.groupInviteLink.findUnique({
      where: { token },
      select: { conversationId: true, revoked: true },
    });
    if (!link || link.revoked) {
      throw new NotFoundException('Link mời không hợp lệ hoặc đã bị thu hồi');
    }

    try {
      const member = await this.prisma.conversationMember.create({
        data: {
          conversationId: link.conversationId,
          userId,
          role: MemberRole.MEMBER,
        },
        select: {
          role: true,
          joinedAt: true,
          user: { select: publicUserSelect },
        },
      });
      this.events.emit('group.member.added', {
        conversationId: link.conversationId,
        member: {
          ...member.user,
          role: member.role,
          joinedAt: member.joinedAt,
        },
        addedById: null,
        // Tự join bằng link là hành động của chính mình -> không cần tự thông báo cho mình
        notify: false,
      });
    } catch (e) {
      // Đã là thành viên rồi -> coi như thành công, không báo lỗi, không emit lại
      if (!isUniqueViolation(e)) throw e;
    }
    return this.getConversationDetail(link.conversationId, userId);
  }

  /** Báo cho socket đang mở sẵn của từng thành viên ban đầu join room mới ngay,
   *  không phải đợi họ tự emit conversation:join (dùng lại đúng event addMember).
   *  creatorId không nhận thông báo in-app vì chính họ vừa tạo conversation này. */
  private async emitMembersAdded(
    conversationId: string,
    userIds: string[],
    options: { addedById: string; notifiable: boolean },
  ) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId, userId: { in: userIds } },
      select: {
        userId: true,
        role: true,
        joinedAt: true,
        user: { select: publicUserSelect },
      },
    });
    for (const m of members) {
      this.events.emit('group.member.added', {
        conversationId,
        member: { ...m.user, role: m.role, joinedAt: m.joinedAt },
        addedById: options.addedById,
        notify: options.notifiable && m.userId !== options.addedById,
      });
    }
  }

  private assertAdmin(membership: ConversationMembership) {
    if (membership.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Chỉ admin mới được thao tác này');
    }
  }

  private async assertGroup(conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    });
    if (!conv || conv.type !== ConversationType.GROUP) {
      throw new BadRequestException('Chỉ áp dụng cho group');
    }
  }

  private async assertFriends(userId: string, otherId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { userId1_userId2: orderedPair(userId, otherId) },
    });
    if (!friendship) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'NOT_FRIENDS',
        message: 'Phải là bạn bè',
      });
    }
  }

  /** Nếu excludeUserId là admin duy nhất, tự thăng thành viên vào sớm nhất lên ADMIN.
   *  Trả về false nếu không còn ai khác để thăng. */
  private async promoteNextAdminIfNeeded(
    tx: Prisma.TransactionClient,
    conversationId: string,
    excludeUserId: string,
  ) {
    const remainingAdmins = await tx.conversationMember.count({
      where: {
        conversationId,
        role: MemberRole.ADMIN,
        userId: { not: excludeUserId },
      },
    });
    if (remainingAdmins > 0) return true;

    // id phụ làm tiebreaker để kết quả ổn định khi joinedAt trùng (vd: tạo group,
    // nhiều thành viên join cùng lúc trong 1 lệnh)
    const next = await tx.conversationMember.findFirst({
      where: { conversationId, userId: { not: excludeUserId } },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    if (!next) return false;

    await tx.conversationMember.update({
      where: { id: next.id },
      data: { role: MemberRole.ADMIN },
    });
    return true;
  }

  private toSummary(
    conv: {
      id: string;
      type: ConversationType;
      name: string | null;
      avatarUrl: string | null;
      backgroundUrl: string | null;
      lastMessageAt: Date | null;
      lastMessage: {
        id: string;
        type: MessageType;
        content: string | null;
        isRecalled: boolean;
        senderId: string;
      } | null;
      members: Array<{
        userId: string;
        role: MemberRole;
        lastReadMessageId: string | null;
        user: {
          id: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
        };
      }>;
    },
    viewerId: string,
    nicknameMap: Map<string, string>,
  ) {
    const me = conv.members.find((m) => m.userId === viewerId);
    // Không đếm số tin chưa đọc chính xác (tốn 1 query COUNT/conversation) — chỉ
    // cần biết CÓ tin chưa đọc hay không, giống cách lastReadMessageId đã đơn giản hoá.
    const unread =
      conv.lastMessage !== null &&
      conv.lastMessage.id !== me?.lastReadMessageId;
    const lastMessage = conv.lastMessage && {
      id: conv.lastMessage.id,
      type: conv.lastMessage.type,
      content: conv.lastMessage.isRecalled ? null : conv.lastMessage.content,
      isRecalled: conv.lastMessage.isRecalled,
      senderId: conv.lastMessage.senderId,
    };

    if (conv.type === ConversationType.GROUP) {
      return {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        avatarUrl: conv.avatarUrl,
        backgroundUrl: conv.backgroundUrl,
        lastMessageAt: conv.lastMessageAt,
        lastMessage,
        unread,
        role: me?.role ?? null,
        memberCount: conv.members.length,
      };
    }

    const other = conv.members.find((m) => m.userId !== viewerId);
    const nickname = other
      ? nicknameMap.get(`${conv.id}:${other.userId}`)
      : undefined;
    return {
      id: conv.id,
      type: conv.type,
      name: nickname ?? other?.user.displayName ?? null,
      avatarUrl: other?.user.avatarUrl ?? null,
      backgroundUrl: conv.backgroundUrl,
      lastMessageAt: conv.lastMessageAt,
      lastMessage,
      unread,
      role: me?.role ?? null,
      otherUser: other
        ? { id: other.user.id, username: other.user.username }
        : null,
    };
  }
}
