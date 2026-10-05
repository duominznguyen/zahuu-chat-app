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
  CallStatus,
  CallType,
  ConversationType,
  MemberRole,
  MessageType,
} from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PresenceService } from '../chat/presence.service.js';
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

const systemMessageSelect = {
  id: true,
  conversationId: true,
  type: true,
  content: true,
  createdAt: true,
  sender: { select: publicUserSelect },
} as const;

function callPreviewText(call: { type: CallType; status: CallStatus }) {
  if (call.status === CallStatus.MISSED) return 'Cuộc gọi nhỡ';
  if (call.status === CallStatus.DECLINED) return 'Đã từ chối cuộc gọi';
  return call.type === CallType.VIDEO ? 'Cuộc gọi video' : 'Cuộc gọi thoại';
}

type SystemMessageContent = {
  event: string;
  actorId: string;
  targetId?: string;
  // Snapshot displayName của target NGAY LÚC tạo tin — target có thể không
  // còn là thành viên khi tin được đọc lại sau này (member_removed/
  // member_left luôn rơi vào đúng tình huống này), lúc đó không còn cách nào
  // tra ngược lại tên qua `members` nữa nên phải lưu sẵn, không dựa hoàn
  // toàn vào lookup runtime (xem translateSystemMessage/system-message.ts).
  targetName?: string;
  newName?: string;
  nickname?: string;
};

const LIST_DEFAULT_LIMIT = 30;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly events: EventEmitter2,
    private readonly presence: PresenceService,
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
            sender: { select: { displayName: true } },
            call: { select: { type: true, status: true } },
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

    // Socket chỉ báo được lúc CHUYỂN trạng thái online/offline, không có cách
    // nào biết trạng thái HIỆN TẠI lúc mới load trang — phải tự tra Redis.
    const onlineMap = await this.presence.isOnlineBatch(
      directTargets.map((t) => t.targetUserId),
    );

    const items = page.map((c) =>
      this.toSummary(c, userId, nicknameMap, onlineMap),
    );
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
    const onlineMap = await this.presence.isOnlineBatch(
      conv.members.map((m) => m.userId),
    );
    const members = conv.members.map((m) => ({
      ...m.user,
      nickname: nicknameMap.get(m.userId) ?? null,
      role: m.role,
      joinedAt: m.joinedAt,
      lastReadMessageId: m.lastReadMessageId,
      lastReadAt: m.lastReadAt,
      isOnline: onlineMap.get(m.userId) ?? false,
    }));
    const me = conv.members.find((m) => m.userId === viewerId);

    // Chỉ có tối đa 1 cuộc gọi hoạt động / conversation (unique activeConversationId).
    const activeCall = await this.prisma.call.findUnique({
      where: { activeConversationId: conversationId },
      select: { id: true, type: true, status: true, startedById: true },
    });

    const base = {
      activeCall,
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

    const systemMessages = await this.prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: membership.conversationId },
        data: { name: dto.name, avatarUrl: dto.avatarUrl },
      });
      const messages: Awaited<ReturnType<typeof this.createSystemMessage>>[] =
        [];
      if (dto.name !== undefined) {
        messages.push(
          await this.createSystemMessage(
            tx,
            membership.conversationId,
            membership.userId,
            'name_changed',
            { newName: dto.name },
          ),
        );
      }
      if (dto.avatarUrl !== undefined) {
        messages.push(
          await this.createSystemMessage(
            tx,
            membership.conversationId,
            membership.userId,
            'avatar_changed',
          ),
        );
      }
      return messages;
    });
    this.events.emit('group.updated', {
      conversationId: membership.conversationId,
      changedFields: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });
    for (const m of systemMessages) this.emitSystemMessage(m);
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
    const systemMessage = await this.prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: membership.conversationId },
        data: { backgroundUrl: dto.url },
      });
      return this.createSystemMessage(
        tx,
        membership.conversationId,
        membership.userId,
        'background_changed',
      );
    });
    this.events.emit('group.updated', {
      conversationId: membership.conversationId,
      changedFields: { backgroundUrl: dto.url },
    });
    this.emitSystemMessage(systemMessage);
    return this.getConversationDetail(
      membership.conversationId,
      membership.userId,
    );
  }

  async leaveConversation(membership: ConversationMembership) {
    await this.assertGroup(membership.conversationId);

    const result = await this.prisma.$transaction(async (tx) => {
      let promotedUserId: string | null = null;
      let promotedDisplayName: string | null = null;
      if (membership.role === MemberRole.ADMIN) {
        const promotion = await this.promoteNextAdminIfNeeded(
          tx,
          membership.conversationId,
          membership.userId,
        );
        if (!promotion.canContinue) {
          // Không còn ai khác -> xóa hẳn nhóm (cascade xóa luôn membership này)
          await tx.conversation.delete({
            where: { id: membership.conversationId },
          });
          return { groupDeleted: true as const };
        }
        promotedUserId = promotion.promotedUserId;
        promotedDisplayName = promotion.promotedDisplayName;
      }
      await tx.conversationMember.delete({
        where: {
          conversationId_userId: {
            conversationId: membership.conversationId,
            userId: membership.userId,
          },
        },
      });
      const leftMessage = await this.createSystemMessage(
        tx,
        membership.conversationId,
        membership.userId,
        'member_left',
      );
      const promotedMessage = promotedUserId
        ? await this.createSystemMessage(
            tx,
            membership.conversationId,
            promotedUserId,
            'role_promoted',
            { targetId: promotedUserId, targetName: promotedDisplayName },
          )
        : null;
      return { groupDeleted: false as const, leftMessage, promotedMessage };
    });

    // Nhóm đã bị xóa hẳn thì không còn room nào để báo
    if (!result.groupDeleted) {
      this.events.emit('group.member.removed', {
        conversationId: membership.conversationId,
        userId: membership.userId,
      });
      this.emitSystemMessage(result.leftMessage);
      if (result.promotedMessage) this.emitSystemMessage(result.promotedMessage);
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
    let systemMessage;
    try {
      ({ member, systemMessage } = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.conversationMember.create({
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
          const systemMessage = await this.createSystemMessage(
            tx,
            membership.conversationId,
            membership.userId,
            'member_added',
            { targetId: targetUserId, targetName: created.user.displayName },
          );
          return { member: created, systemMessage };
        },
      ));
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
    this.emitSystemMessage(systemMessage);
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

    const systemMessage = await this.prisma.$transaction(async (tx) => {
      const target = await tx.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: membership.conversationId,
            userId: targetUserId,
          },
        },
        select: { user: { select: { displayName: true } } },
      });
      if (!target) {
        throw new NotFoundException('Người này không phải thành viên');
      }
      await tx.conversationMember.delete({
        where: {
          conversationId_userId: {
            conversationId: membership.conversationId,
            userId: targetUserId,
          },
        },
      });
      return this.createSystemMessage(
        tx,
        membership.conversationId,
        membership.userId,
        'member_removed',
        { targetId: targetUserId, targetName: target.user.displayName },
      );
    });
    this.events.emit('group.member.removed', {
      conversationId: membership.conversationId,
      userId: targetUserId,
    });
    this.emitSystemMessage(systemMessage);
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
      include: { user: { select: { displayName: true } } },
    });
    if (!target) throw new NotFoundException('Người này không phải thành viên');
    if (target.role === role) return;

    const { mainMessage, promotedMessage } = await this.prisma.$transaction(
      async (tx) => {
        let promotedUserId: string | null = null;
        let promotedDisplayName: string | null = null;
        if (target.role === MemberRole.ADMIN && role === MemberRole.MEMBER) {
          const result = await this.promoteNextAdminIfNeeded(
            tx,
            membership.conversationId,
            targetUserId,
          );
          if (!result.canContinue) {
            throw new ConflictException(
              'Không thể giáng chức admin duy nhất khi nhóm không còn thành viên nào khác',
            );
          }
          promotedUserId = result.promotedUserId;
          promotedDisplayName = result.promotedDisplayName;
        }
        await tx.conversationMember.update({
          where: { id: target.id },
          data: { role },
        });

        const mainMessage = await this.createSystemMessage(
          tx,
          membership.conversationId,
          membership.userId,
          role === MemberRole.ADMIN ? 'role_promoted' : 'role_demoted',
          { targetId: targetUserId, targetName: target.user.displayName },
        );
        // Chính sách "admin cuối cùng" tự thăng 1 người khác khi giáng chức
        // chính admin cuối — phải báo riêng, không thì người xem chat chỉ
        // thấy "giáng chức X" mà không biết ai vừa thành admin mới.
        const promotedMessage = promotedUserId
          ? await this.createSystemMessage(
              tx,
              membership.conversationId,
              promotedUserId,
              'role_promoted',
              { targetId: promotedUserId, targetName: promotedDisplayName },
            )
          : null;
        return { mainMessage, promotedMessage };
      },
    );
    this.emitSystemMessage(mainMessage);
    if (promotedMessage) this.emitSystemMessage(promotedMessage);
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
      include: { user: { select: { displayName: true } } },
    });
    if (!target) throw new NotFoundException('Người này không phải thành viên');

    const systemMessage = await this.prisma.$transaction(async (tx) => {
      await tx.conversationNickname.upsert({
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
      return this.createSystemMessage(
        tx,
        membership.conversationId,
        membership.userId,
        'nickname_set',
        { targetId: targetUserId, targetName: target.user.displayName, nickname },
      );
    });
    this.events.emit('group.updated', {
      conversationId: membership.conversationId,
      changedFields: { nickname: { targetUserId, nickname } },
    });
    this.emitSystemMessage(systemMessage);
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

  // Xem trước nhóm trước khi join — không tạo membership, chỉ đọc. Cho phép
  // client hiện màn xác nhận (kiểu Zalo) thay vì join thẳng ngay khi bấm link,
  // và tự biết có nên hiện nút "Tham gia" hay vào thẳng luôn nếu đã là thành viên.
  async previewInviteLink(userId: string, token: string) {
    await assertCallerActive(this.prisma, userId);

    const link = await this.prisma.groupInviteLink.findUnique({
      where: { token },
      select: {
        revoked: true,
        conversation: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            members: { select: { userId: true } },
          },
        },
      },
    });
    if (!link || link.revoked) {
      throw new NotFoundException('Link mời không hợp lệ hoặc đã bị thu hồi');
    }

    return {
      conversationId: link.conversation.id,
      name: link.conversation.name,
      avatarUrl: link.conversation.avatarUrl,
      memberCount: link.conversation.members.length,
      alreadyMember: link.conversation.members.some((m) => m.userId === userId),
    };
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
      const { member, systemMessage } = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.conversationMember.create({
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
          const systemMessage = await this.createSystemMessage(
            tx,
            link.conversationId,
            userId,
            'member_joined_via_link',
          );
          return { member: created, systemMessage };
        },
      );
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
      this.emitSystemMessage(systemMessage);
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
   *  `canContinue: false` nghĩa là không còn ai khác trong nhóm để thăng (gọi nơi
   *  dùng phải tự xử lý — vd xóa hẳn nhóm). `promotedUserId` khác null khi có
   *  người vừa được thăng, để nơi gọi tự phát tin hệ thống `role_promoted` cho
   *  đúng người đó (phân biệt với trường hợp đã sẵn có admin khác, không cần thăng ai). */
  private async promoteNextAdminIfNeeded(
    tx: Prisma.TransactionClient,
    conversationId: string,
    excludeUserId: string,
  ): Promise<{
    canContinue: boolean;
    promotedUserId: string | null;
    promotedDisplayName: string | null;
  }> {
    const remainingAdmins = await tx.conversationMember.count({
      where: {
        conversationId,
        role: MemberRole.ADMIN,
        userId: { not: excludeUserId },
      },
    });
    if (remainingAdmins > 0) {
      return { canContinue: true, promotedUserId: null, promotedDisplayName: null };
    }

    // id phụ làm tiebreaker để kết quả ổn định khi joinedAt trùng (vd: tạo group,
    // nhiều thành viên join cùng lúc trong 1 lệnh)
    const next = await tx.conversationMember.findFirst({
      where: { conversationId, userId: { not: excludeUserId } },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      select: { userId: true, user: { select: { displayName: true } } },
    });
    if (!next) {
      return { canContinue: false, promotedUserId: null, promotedDisplayName: null };
    }

    await tx.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: next.userId } },
      data: { role: MemberRole.ADMIN },
    });
    return {
      canContinue: true,
      promotedUserId: next.userId,
      promotedDisplayName: next.user.displayName,
    };
  }

  /** Tạo 1 tin SYSTEM trong CÙNG transaction của hành động gốc + cập nhật
   *  Conversation.lastMessageAt/lastMessageId giống tin nhắn thường (để nổi
   *  lên đầu danh sách conversation). `senderId` = actor (người thực hiện
   *  hành động) — tái dùng quan hệ `sender` có sẵn, không thêm cột riêng. */
  private async createSystemMessage(
    tx: Prisma.TransactionClient,
    conversationId: string,
    actorId: string,
    event: string,
    payload: Record<string, unknown> = {},
  ) {
    const content: SystemMessageContent = { event, actorId, ...payload };
    const created = await tx.message.create({
      data: {
        conversationId,
        senderId: actorId,
        type: MessageType.SYSTEM,
        content: JSON.stringify(content),
      },
      select: systemMessageSelect,
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: created.createdAt, lastMessageId: created.id },
    });
    return created;
  }

  /** Broadcast tin SYSTEM vừa tạo giống hệt tin nhắn thường qua `message.created`
   *  — ChatGateway không cần biết gì khác, `message:new` đã broadcast đúng cơ chế.
   *  Gọi SAU KHI transaction tạo tin đã commit (không emit trong lúc còn transaction). */
  private emitSystemMessage(
    created: Awaited<ReturnType<typeof this.createSystemMessage>>,
  ) {
    this.events.emit('message.created', {
      conversationId: created.conversationId,
      message: {
        id: created.id,
        conversationId: created.conversationId,
        sender: created.sender,
        type: created.type,
        content: created.content,
        mediaUrl: null,
        mediaPublicId: null,
        mediaName: null,
        mediaSize: null,
        replyTo: null,
        isRecalled: false,
        recalledAt: null,
        createdAt: created.createdAt,
        reactions: [],
      },
    });
  }

  private parseSystemContent(content: string): SystemMessageContent {
    return JSON.parse(content) as SystemMessageContent;
  }

  /** Dịch tin SYSTEM sang tiếng Việt cho preview trên conversation list — CHỈ
   *  dùng `displayName` thuần (không tra nickname) vì list không có context
   *  đầy đủ như trong chat; `MessageBubble` phía client tự dịch lại bằng
   *  nickname thật khi hiện trong đúng đoạn chat. */
  private translateSystemMessage(content: string, actorName: string): string {
    const data = this.parseSystemContent(content);
    const targetName = data.targetName;
    switch (data.event) {
      case 'member_added':
        return `${actorName} đã thêm ${targetName} vào nhóm`;
      case 'member_joined_via_link':
        return `${actorName} đã tham gia nhóm qua link mời`;
      case 'member_left':
        return `${actorName} đã rời nhóm`;
      case 'member_removed':
        return `${actorName} đã xoá ${targetName} khỏi nhóm`;
      case 'role_promoted':
        return `${actorName} đã bổ nhiệm ${targetName} làm quản trị viên`;
      case 'role_demoted':
        return `${actorName} đã gỡ quyền quản trị viên của ${targetName}`;
      case 'name_changed':
        return `${actorName} đã đổi tên nhóm thành "${data.newName}"`;
      case 'avatar_changed':
        return `${actorName} đã đổi ảnh đại diện nhóm`;
      case 'background_changed':
        return `${actorName} đã đổi hình nền đoạn chat`;
      case 'nickname_set':
        return `${actorName} đã đặt biệt danh cho ${targetName} là "${data.nickname}"`;
      default:
        return '';
    }
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
        sender: { displayName: string };
        call: { type: CallType; status: CallStatus } | null;
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
    onlineMap: Map<string, boolean>,
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
      previewText:
        conv.lastMessage.type === MessageType.SYSTEM
          ? this.translateSystemMessage(
              conv.lastMessage.content!,
              conv.lastMessage.sender.displayName,
            )
          : conv.lastMessage.type === MessageType.CALL && conv.lastMessage.call
            ? callPreviewText(conv.lastMessage.call)
            : null,
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
        ? {
            id: other.user.id,
            username: other.user.username,
            isOnline: onlineMap.get(other.user.id) ?? false,
          }
        : null,
    };
  }
}
