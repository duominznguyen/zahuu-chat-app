import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service.js';
import { PresenceService } from './presence.service.js';

interface MessageCreatedEvent {
  conversationId: string;
  message: unknown;
}
interface MessageRecalledEvent {
  conversationId: string;
  messageId: string;
}
interface MessageReactionEvent {
  conversationId: string;
  messageId: string;
  userId: string;
  reactionType: string | null;
}
interface MessageReadEvent {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
}
interface FriendRequestReceivedEvent {
  receiverId: string;
  request: unknown;
}
interface FriendAcceptedEvent {
  userId: string;
  otherUserId: string;
}
interface GroupMemberAddedEvent {
  conversationId: string;
  member: { id: string } & Record<string, unknown>;
}
interface GroupMemberRemovedEvent {
  conversationId: string;
  userId: string;
}
interface GroupUpdatedEvent {
  conversationId: string;
  changedFields: Record<string, unknown>;
}

const userRoom = (userId: string) => `user:${userId}`;
const conversationRoom = (conversationId: string) =>
  `conversation:${conversationId}`;

// Gateway DUY NHẤT cho toàn bộ app — không tách gateway theo module. Chỉ broadcast
// kết quả đã xử lý xong qua REST/EventEmitter2, không chứa business logic ở đây.
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    let userId: string;
    try {
      if (!token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        algorithms: ['HS256'],
      });
      userId = payload.sub;
    } catch {
      client.disconnect(true);
      return;
    }
    client.data.userId = userId;

    await client.join(userRoom(userId));
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    await Promise.all(
      memberships.map((m) => client.join(conversationRoom(m.conversationId))),
    );

    if (await this.presence.connect(userId)) {
      await this.broadcastPresence(userId, true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    if (await this.presence.disconnect(userId)) {
      const lastSeenAt = new Date();
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt },
      });
      await this.broadcastPresence(userId, false, lastSeenAt);
    }
  }

  @SubscribeMessage('conversation:join')
  async onConversationJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: body.conversationId, userId },
      },
      select: { userId: true },
    });
    if (member) await client.join(conversationRoom(body.conversationId));
  }

  @SubscribeMessage('conversation:leave')
  onConversationLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    client.leave(conversationRoom(body.conversationId));
  }

  @SubscribeMessage('message:typing')
  async onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    await this.relayTyping(client, body.conversationId, 'message:typing');
  }

  @SubscribeMessage('message:stopTyping')
  async onStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    await this.relayTyping(client, body.conversationId, 'message:stopTyping');
  }

  @OnEvent('message.created')
  onMessageCreated({ conversationId, message }: MessageCreatedEvent) {
    this.server
      .to(conversationRoom(conversationId))
      .emit('message:new', message);
  }

  @OnEvent('message.recalled')
  onMessageRecalled({ conversationId, messageId }: MessageRecalledEvent) {
    this.server
      .to(conversationRoom(conversationId))
      .emit('message:recalled', { messageId, conversationId });
  }

  @OnEvent('message.reaction')
  onMessageReaction({
    conversationId,
    messageId,
    userId,
    reactionType,
  }: MessageReactionEvent) {
    this.server
      .to(conversationRoom(conversationId))
      .emit('message:reaction', { messageId, userId, reactionType });
  }

  @OnEvent('message.read')
  onMessageRead({
    conversationId,
    userId,
    lastReadMessageId,
  }: MessageReadEvent) {
    this.server
      .to(conversationRoom(conversationId))
      .emit('message:read', { conversationId, userId, lastReadMessageId });
  }

  @OnEvent('friend.request.received')
  onFriendRequestReceived({ receiverId, request }: FriendRequestReceivedEvent) {
    this.server
      .to(userRoom(receiverId))
      .emit('friend:requestReceived', request);
  }

  @OnEvent('friend.accepted')
  onFriendAccepted({ userId, otherUserId }: FriendAcceptedEvent) {
    this.server
      .to(userRoom(userId))
      .emit('friend:accepted', { userId: otherUserId });
  }

  @OnEvent('group.member.added')
  async onGroupMemberAdded({ conversationId, member }: GroupMemberAddedEvent) {
    this.server
      .to(conversationRoom(conversationId))
      .emit('group:memberAdded', { conversationId, member });
    // Thành viên mới có thể đang online từ trước -> cho socket của họ join luôn room,
    // không phải chờ client tự emit conversation:join
    const sockets = await this.server.in(userRoom(member.id)).fetchSockets();
    for (const s of sockets) s.join(conversationRoom(conversationId));
  }

  @OnEvent('group.member.removed')
  async onGroupMemberRemoved({
    conversationId,
    userId,
  }: GroupMemberRemovedEvent) {
    this.server
      .to(conversationRoom(conversationId))
      .emit('group:memberRemoved', { conversationId, userId });
    // Người bị xóa/vừa rời không còn thuộc nhóm -> rời room để không nhận broadcast sau này
    const sockets = await this.server.in(userRoom(userId)).fetchSockets();
    for (const s of sockets) s.leave(conversationRoom(conversationId));
  }

  @OnEvent('group.updated')
  onGroupUpdated({ conversationId, changedFields }: GroupUpdatedEvent) {
    this.server
      .to(conversationRoom(conversationId))
      .emit('group:updated', { conversationId, ...changedFields });
  }

  private async relayTyping(
    client: Socket,
    conversationId: string,
    event: string,
  ) {
    const userId = client.data.userId as string;
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { userId: true },
    });
    if (!member) return; // không phải thành viên -> không cho giả mạo typing trong room khác
    client
      .to(conversationRoom(conversationId))
      .emit(event, { conversationId, userId });
  }

  private async broadcastPresence(
    userId: string,
    isOnline: boolean,
    lastSeenAt: Date | null = null,
  ) {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userId1: userId }, { userId2: userId }] },
      select: { userId1: true, userId2: true },
    });
    const payload = { userId, isOnline, lastSeenAt };
    for (const f of friendships) {
      const friendId = f.userId1 === userId ? f.userId2 : f.userId1;
      this.server.to(userRoom(friendId)).emit('presence:update', payload);
    }
    this.logger.debug(
      `presence ${userId} -> ${isOnline ? 'online' : 'offline'}`,
    );
  }
}
