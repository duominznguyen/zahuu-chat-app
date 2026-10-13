import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import { assertDirectNotBlocked } from '../common/direct-block.js';
import type { ConversationMembership } from '../conversations/decorators/membership.decorator.js';
import {
  CallStatus,
  CallType,
  MessageType,
} from '../generated/prisma/enums.js';
import { MEDIA_CLEANUP_QUEUE } from '../media/media-cleanup.queue.js';
import type { MediaCleanupJob } from '../media/media-cleanup.processor.js';
import { MediaPurpose } from '../media/media-purpose.enum.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListMediaDto } from './dto/list-media.dto.js';
import type { ListMessagesDto } from './dto/list-messages.dto.js';
import type { SearchMessagesDto } from './dto/search-messages.dto.js';
import type { SendMessageDto } from './dto/send-message.dto.js';

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const replyToSelect = {
  id: true,
  senderId: true,
  type: true,
  content: true,
  mediaUrl: true,
  mediaName: true,
  isRecalled: true,
} as const;

const callSummarySelect = {
  id: true,
  type: true,
  status: true,
  startedAt: true,
  endedAt: true,
} as const;

const messageInclude = {
  sender: { select: publicUserSelect },
  replyTo: { select: replyToSelect },
  call: { select: callSummarySelect },
} as const;

const MEDIA_TYPES: MessageType[] = [
  MessageType.IMAGE,
  MessageType.VIDEO,
  MessageType.FILE,
];
// Tin do hệ thống sinh ra (sự kiện nhóm, lịch sử cuộc gọi) — không thu hồi/react/trả lời được.
const NON_INTERACTIVE_TYPES: MessageType[] = [
  MessageType.SYSTEM,
  MessageType.CALL,
];
const LIST_DEFAULT_LIMIT = 30;
const AROUND_HALF_WINDOW = 30;

type MessageWithRelations = {
  id: string;
  conversationId: string;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaPublicId: string | null;
  mediaName: string | null;
  mediaSize: number | null;
  isRecalled: boolean;
  recalledAt: Date | null;
  createdAt: Date;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  call: {
    id: string;
    type: CallType;
    status: CallStatus;
    startedAt: Date;
    endedAt: Date | null;
  } | null;
  replyTo: {
    id: string;
    senderId: string;
    type: MessageType;
    content: string | null;
    mediaUrl: string | null;
    mediaName: string | null;
    isRecalled: boolean;
  } | null;
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly events: EventEmitter2,
    @InjectQueue(MEDIA_CLEANUP_QUEUE)
    private readonly cleanupQueue: Queue<MediaCleanupJob>,
  ) {}

  async listMessages(membership: ConversationMembership, dto: ListMessagesDto) {
    const take = dto.limit ?? LIST_DEFAULT_LIMIT;
    if (dto.after) return this.listNewerMessages(membership, dto.after, take);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: membership.conversationId,
        deletions: { none: { userId: membership.userId } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      include: messageInclude,
    });

    const hasMore = messages.length > take;
    const page = messages.slice(0, take);
    const items = await this.toViewsWithReactions(page);
    return { items, nextCursor: hasMore ? page[page.length - 1].id : null };
  }

  /** Trang tin MỚI HƠN 1 tin (vẫn trả mới nhất trước như listMessages). `hasNewer`
   *  cho client biết đã chạm tin mới nhất của đoạn chat hay chưa. */
  private async listNewerMessages(
    membership: ConversationMembership,
    afterId: string,
    take: number,
  ) {
    const visible = {
      conversationId: membership.conversationId,
      deletions: { none: { userId: membership.userId } },
    };
    // Không lọc theo deletions: tin mốc có thể vừa bị xoá-cho-mình, vẫn dùng
    // được làm mốc thời gian.
    const anchor = await this.prisma.message.findFirst({
      where: { id: afterId, conversationId: membership.conversationId },
      select: { id: true, createdAt: true },
    });
    if (!anchor) throw new NotFoundException('Không tìm thấy tin nhắn');

    const newer = await this.prisma.message.findMany({
      where: {
        ...visible,
        OR: [
          { createdAt: { gt: anchor.createdAt } },
          { createdAt: anchor.createdAt, id: { gt: anchor.id } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
      include: messageInclude,
    });
    const hasNewer = newer.length > take;
    const page = newer.slice(0, take).reverse();
    const items = await this.toViewsWithReactions(page);
    // nextCursor = tin cũ nhất của trang: client refetch cả danh sách (vd khi
    // kết nối lại) dò các trang sau theo nextCursor của trang trước — trả null
    // ở đây sẽ làm mất toàn bộ các trang cũ hơn bên dưới trang này.
    const nextCursor = page.length ? page[page.length - 1].id : afterId;
    return { items, nextCursor, hasNewer };
  }

  /** Cửa sổ tin quanh 1 tin (mới nhất trước). Thời gian không phụ thuộc khoảng cách tới tin đó. */
  async aroundMessage(membership: ConversationMembership, messageId: string) {
    const visible = {
      conversationId: membership.conversationId,
      deletions: { none: { userId: membership.userId } },
    };
    const target = await this.prisma.message.findFirst({
      where: { ...visible, id: messageId },
      include: messageInclude,
    });
    if (!target) throw new NotFoundException('Không tìm thấy tin nhắn');

    const half = AROUND_HALF_WINDOW;
    const olderThan = {
      OR: [
        { createdAt: { lt: target.createdAt } },
        { createdAt: target.createdAt, id: { lt: target.id } },
      ],
    };
    const newerThan = {
      OR: [
        { createdAt: { gt: target.createdAt } },
        { createdAt: target.createdAt, id: { gt: target.id } },
      ],
    };
    const [older, newer] = await Promise.all([
      this.prisma.message.findMany({
        where: { ...visible, ...olderThan },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: half + 1,
        include: messageInclude,
      }),
      this.prisma.message.findMany({
        where: { ...visible, ...newerThan },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: half + 1,
        include: messageInclude,
      }),
    ]);

    const hasOlder = older.length > half;
    const hasNewer = newer.length > half;
    const olderPage = older.slice(0, half);
    const newerPage = newer.slice(0, half).reverse();
    const window = [...newerPage, target, ...olderPage];
    const items = await this.toViewsWithReactions(window);
    return {
      items,
      nextCursor: hasOlder ? olderPage[olderPage.length - 1].id : null,
      hasNewer,
    };
  }

  private async toViewsWithReactions(page: MessageWithRelations[]) {
    const reactions = page.length
      ? await this.prisma.messageReaction.findMany({
          where: { messageId: { in: page.map((m) => m.id) } },
          select: { messageId: true, userId: true, reactionType: true },
        })
      : [];
    const reactionsByMessage = new Map<string, { userId: string; reactionType: string }[]>();
    for (const r of reactions) {
      const arr = reactionsByMessage.get(r.messageId) ?? [];
      arr.push({ userId: r.userId, reactionType: r.reactionType });
      reactionsByMessage.set(r.messageId, arr);
    }
    return page.map((m) => this.toMessageView(m, reactionsByMessage.get(m.id) ?? []));
  }

  async searchMessages(membership: ConversationMembership, dto: SearchMessagesDto) {
    const take = dto.limit ?? LIST_DEFAULT_LIMIT;
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: membership.conversationId,
        type: MessageType.TEXT,
        isRecalled: false,
        content: { contains: dto.q },
        deletions: { none: { userId: membership.userId } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: { select: publicUserSelect },
      },
    });
    const hasMore = messages.length > take;
    const page = messages.slice(0, take);
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async listMediaMessages(membership: ConversationMembership, dto: ListMediaDto) {
    const take = dto.limit ?? LIST_DEFAULT_LIMIT;
    const types = dto.kind === 'MEDIA' ? [MessageType.IMAGE, MessageType.VIDEO] : [MessageType.FILE];
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: membership.conversationId,
        type: { in: types },
        isRecalled: false,
        deletions: { none: { userId: membership.userId } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      include: messageInclude,
    });
    const hasMore = messages.length > take;
    const page = messages.slice(0, take);
    return {
      items: page.map((m) => this.toMessageView(m)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async sendMessage(membership: ConversationMembership, dto: SendMessageDto) {
    await assertDirectNotBlocked(this.prisma, membership.conversationId);
    if (dto.replyToId) {
      const replyTo = await this.prisma.message.findUnique({
        where: { id: dto.replyToId },
        select: { conversationId: true, type: true },
      });
      if (!replyTo || replyTo.conversationId !== membership.conversationId) {
        throw new BadRequestException('replyToId không hợp lệ');
      }
      if (NON_INTERACTIVE_TYPES.includes(replyTo.type)) {
        throw new BadRequestException('Không thể trả lời tin nhắn này');
      }
    }

    const isMedia = MEDIA_TYPES.includes(dto.type);
    if (isMedia) {
      this.media.assertOwnedMedia(
        membership.userId,
        MediaPurpose.MESSAGE,
        dto.mediaUrl!,
        dto.mediaPublicId!,
      );
    }
    const isFile = dto.type === MessageType.FILE;

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId: membership.conversationId,
          senderId: membership.userId,
          type: dto.type,
          content: isMedia ? null : dto.content,
          mediaUrl: isMedia ? dto.mediaUrl : null,
          mediaPublicId: isMedia ? dto.mediaPublicId : null,
          mediaName: isFile ? dto.mediaName : null,
          mediaSize: isFile ? dto.mediaSize : null,
          replyToId: dto.replyToId,
        },
        include: messageInclude,
      });
      await tx.conversation.update({
        where: { id: membership.conversationId },
        data: { lastMessageAt: created.createdAt, lastMessageId: created.id },
      });
      return created;
    });

    const view = this.toMessageView(message);
    this.events.emit('message.created', {
      conversationId: membership.conversationId,
      message: view,
    });
    return view;
  }

  async recallMessage(userId: string, messageId: string) {
    const message = await this.loadOwnScope(userId, messageId);
    if (NON_INTERACTIVE_TYPES.includes(message.type)) {
      throw new BadRequestException('Không thể thu hồi tin nhắn này');
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException(
        'Chỉ người gửi mới được thu hồi tin nhắn này',
      );
    }
    if (message.isRecalled) return; // idempotent, không enqueue xóa file lần 2

    await this.prisma.message.update({
      where: { id: messageId },
      data: { isRecalled: true, recalledAt: new Date() },
    });

    if (message.mediaPublicId) {
      await this.cleanupQueue.add(
        'delete-asset',
        {
          publicId: message.mediaPublicId,
          resourceType: this.resourceTypeOf(message.type),
        },
        { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
      );
    }
    this.events.emit('message.recalled', {
      conversationId: message.conversationId,
      messageId,
    });
  }

  async deleteForMe(userId: string, messageId: string) {
    await this.loadOwnScope(userId, messageId);
    await this.prisma.messageDeletion.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId },
      update: {},
    });
  }

  async setReaction(userId: string, messageId: string, reactionType: string) {
    const message = await this.loadOwnScope(userId, messageId);
    if (NON_INTERACTIVE_TYPES.includes(message.type)) {
      throw new BadRequestException(
        'Không thể thả cảm xúc cho tin nhắn này',
      );
    }
    if (message.isRecalled) {
      throw new BadRequestException(
        'Không thể thả cảm xúc cho tin nhắn đã thu hồi',
      );
    }
    await this.prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, reactionType },
      update: { reactionType },
    });
    this.events.emit('message.reaction', {
      conversationId: message.conversationId,
      messageId,
      userId,
      reactionType,
    });
  }

  async removeReaction(userId: string, messageId: string) {
    const message = await this.loadOwnScope(userId, messageId);
    await this.prisma.messageReaction.deleteMany({
      where: { messageId, userId },
    });
    this.events.emit('message.reaction', {
      conversationId: message.conversationId,
      messageId,
      userId,
      reactionType: null,
    });
  }

  async markRead(
    membership: ConversationMembership,
    lastReadMessageId: string,
  ) {
    const target = await this.prisma.message.findUnique({
      where: { id: lastReadMessageId },
      select: { conversationId: true, createdAt: true },
    });
    if (!target || target.conversationId !== membership.conversationId) {
      throw new BadRequestException('lastReadMessageId không hợp lệ');
    }

    const self = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: membership.conversationId,
          userId: membership.userId,
        },
      },
      select: { lastReadMessageId: true },
    });
    if (self?.lastReadMessageId) {
      const current = await this.prisma.message.findUnique({
        where: { id: self.lastReadMessageId },
        select: { createdAt: true },
      });
      // cursor đã đọc không được lùi về trước
      if (current && current.createdAt >= target.createdAt) return;
    }

    await this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: membership.conversationId,
          userId: membership.userId,
        },
      },
      data: { lastReadMessageId, lastReadAt: new Date() },
    });
    this.events.emit('message.read', {
      conversationId: membership.conversationId,
      userId: membership.userId,
      lastReadMessageId,
    });
  }

  /** Dùng cho các route /messages/:id/* không có conversationId trong URL
   *  nên không qua được ConversationMemberGuard — tự kiểm tra thành viên ở đây. */
  private async loadOwnScope(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    const notFound = () => new NotFoundException('Không tìm thấy tin nhắn');
    if (!message) throw notFound();

    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId,
        },
      },
      select: { userId: true },
    });
    if (!member) throw notFound();
    return message;
  }

  private resourceTypeOf(type: MessageType): 'image' | 'video' | 'raw' {
    if (type === MessageType.IMAGE) return 'image';
    if (type === MessageType.VIDEO) return 'video';
    return 'raw';
  }

  private toMessageView(
    m: MessageWithRelations,
    reactions: { userId: string; reactionType: string }[] = [],
  ) {
    return {
      id: m.id,
      conversationId: m.conversationId,
      sender: m.sender,
      type: m.type,
      content: m.isRecalled ? null : m.content,
      mediaUrl: m.isRecalled ? null : m.mediaUrl,
      mediaPublicId: m.isRecalled ? null : m.mediaPublicId,
      mediaName: m.isRecalled ? null : m.mediaName,
      mediaSize: m.isRecalled ? null : m.mediaSize,
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            senderId: m.replyTo.senderId,
            type: m.replyTo.type,
            content: m.replyTo.isRecalled ? null : m.replyTo.content,
            mediaUrl: m.replyTo.isRecalled ? null : m.replyTo.mediaUrl,
            mediaName: m.replyTo.isRecalled ? null : m.replyTo.mediaName,
            isRecalled: m.replyTo.isRecalled,
          }
        : null,
      call: m.call,
      isRecalled: m.isRecalled,
      recalledAt: m.recalledAt,
      createdAt: m.createdAt,
      reactions: m.isRecalled ? [] : reactions,
    };
  }
}
