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

  // Tra nhiều user cùng lúc bằng 1 round-trip Redis (MGET) — tránh N+1 khi
  // trả danh sách conversation/member kèm trạng thái online ban đầu.
  async isOnlineBatch(userIds: string[]): Promise<Map<string, boolean>> {
    if (userIds.length === 0) return new Map();
    const counts = await this.redis.mget(userIds.map((id) => this.key(id)));
    return new Map(
      userIds.map((id, i) => [id, Number(counts[i] ?? 0) > 0]),
    );
  }
}
