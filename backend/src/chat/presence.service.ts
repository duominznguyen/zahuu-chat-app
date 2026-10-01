import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

// Đếm theo số socket đang mở (không phải boolean) để 1 user mở nhiều
// tab/thiết bị vẫn chỉ "offline" khi socket CUỐI CÙNG đóng lại.
@Injectable()
export class PresenceService {
  constructor(private readonly redis: RedisService) {}

  private key(userId: string) {
    return `presence:${userId}`;
  }

  /** true nếu đây là kết nối đầu tiên của user (vừa chuyển sang online). */
  async connect(userId: string): Promise<boolean> {
    const count = await this.redis.incr(this.key(userId));
    return count === 1;
  }

  /** true nếu đây là kết nối cuối cùng vừa đóng (vừa chuyển sang offline). */
  async disconnect(userId: string): Promise<boolean> {
    const count = await this.redis.decr(this.key(userId));
    if (count <= 0) {
      await this.redis.del(this.key(userId));
      return true;
    }
    return false;
  }

  async isOnline(userId: string): Promise<boolean> {
    const count = await this.redis.get(this.key(userId));
    return Number(count ?? 0) > 0;
  }
}
