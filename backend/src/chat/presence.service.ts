import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

// Đếm theo số socket đang mở (không phải boolean) để 1 user mở nhiều
// tab/thiết bị vẫn chỉ "offline" khi socket CUỐI CÙNG đóng lại.
@Injectable()
export class PresenceService implements OnModuleInit {
  private readonly logger = new Logger(PresenceService.name);

  constructor(private readonly redis: RedisService) {}

  // Backend restart (deploy, crash, kill thủ công lúc dev) cắt NGANG mọi kết
  // nối socket đang mở mà KHÔNG chạy được handler disconnect() tương ứng —
  // counter trong Redis vì vậy bị "rò rỉ" (INCR không có DECR khớp), kẹt vĩnh
  // viễn > 0 dù không còn ai thực sự kết nối. Bug thật đã xảy ra: 1 tài khoản
  // hiện "đang hoạt động" dù chưa hề đăng nhập trong phiên hiện tại, counter
  // Redis kẹt ở giá trị hàng chục do tích lũy qua nhiều lần restart backend
  // lúc dev. Mọi socket ĐANG kết nối lúc server khởi động lại đều sẽ tự
  // reconnect trong vài giây (socket.io-client tự động) và tự INCR lại từ
  // đầu, nên xóa sạch hết counter cũ lúc khởi động là an toàn tuyệt đối —
  // không có counter nào "đúng" sống sót qua 1 lần restart cả.
  async onModuleInit() {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        'presence:*',
        'COUNT',
        1000,
      );
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.log(`Đã xóa ${keys.length} presence counter còn sót lại từ lần chạy trước`);
    }
  }

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
