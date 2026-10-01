import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { FCM_SEND_QUEUE, type FcmSendJob } from './fcm-send.queue.js';
import { FcmService } from './fcm.service.js';

// Mã lỗi của Firebase khi token không còn hợp lệ (gỡ app, hết hạn...) — retry
// không bao giờ thành công nên dọn khỏi DB thay vì để BullMQ thử lại vô ích.
const DEAD_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

@Processor(FCM_SEND_QUEUE)
export class FcmSendProcessor extends WorkerHost {
  private readonly logger = new Logger(FcmSendProcessor.name);

  constructor(
    private readonly fcm: FcmService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<FcmSendJob>) {
    const { deviceTokenId, fcmToken, title, body, data } = job.data;
    try {
      await this.fcm.send(fcmToken, title, body, data);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code && DEAD_TOKEN_ERROR_CODES.has(code)) {
        await this.prisma.deviceToken.deleteMany({
          where: { id: deviceTokenId },
        });
        this.logger.log(`Token hết hạn, đã xóa deviceToken ${deviceTokenId}`);
        return;
      }
      throw e; // lỗi khác (mạng, tạm thời...) -> để BullMQ retry
    }
  }
}
