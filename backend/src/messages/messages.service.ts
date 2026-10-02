import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import type { ConversationMembership } from '../conversations/decorators/membership.decorator.js';
import { MessageType } from '../generated/prisma/enums.js';
import { MEDIA_CLEANUP_QUEUE } from '../media/media-cleanup.queue.js';
import type { MediaCleanupJob } from '../media/media-cleanup.processor.js';
import { MediaPurpose } from '../media/media-purpose.enum.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListMessagesDto } from './dto/list-messages.dto.js';
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
  isRecalled: true,
} as const;

const messageInclude = {
  sender: { select: publicUserSelect },
  replyTo: { select: replyToSelect },
} as const;

const MEDIA_TYPES: MessageType[] = [
  MessageType.IMAGE,
  MessageType.VIDEO,
  MessageType.FILE,
];
const LIST_DEFAULT_LIMIT = 30;

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
  replyTo: {
    id: string;
    senderId: string;
    type: MessageType;
    content: string | null;
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

    const reactions = page.length
      ? await this.prisma.messageReaction.findMany({
          where: { messageId: { in: page.map((m) => m.id) } },
          select: { messageId: true, userId: true, reactionType: true },
        })
      : [];
    const reactionsByMessage = new Map<
      string,
      { userId: string; reactionType: string }[]
    >();
    for (const r of reactions) {
      const arr = reactionsByMessage.get(r.messageId) ?? [];
      arr.push({ userId: r.userId, reactionType: r.reactionType });
      reactionsByMessage.set(r.messageId, arr);
    }

    const items = page.map((m) =>
      this.toMessageView(m, reactionsByMessage.get(m.id) ?? []),
    );
    return { items, nextCursor: hasMore ? page[page.length - 1].id : null };
  }

  async sendMessage(membership: ConversationMembership, dto: SendMessageDto) {
    if (dto.replyToId) {
      const replyTo = await this.prisma.message.findUnique({
        where: { id: dto.replyToId },
        select: { conversationId: true },
      });
      if (!replyTo || replyTo.conversationId !== membership.conversationId) {
        throw new BadRequestException('replyToId không hợp lệ');
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
            isRecalled: m.replyTo.isRecalled,
          }
        : null,
      isRecalled: m.isRecalled,
      recalledAt: m.recalledAt,
      createdAt: m.createdAt,
      reactions: m.isRecalled ? [] : reactions,
    };
  }
}
