import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// ThrottlerGuard mặc định giả định context là HTTP (gọi res.header(...) để set
// rate-limit headers) nên văng lỗi khi chạy trên WebSocket message handler.
// Rate limit cho socket (nếu cần) nên làm riêng ở ChatGateway, không qua guard này.
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    return context.getType() !== 'http';
  }
}
