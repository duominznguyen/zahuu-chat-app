import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly messaging: Messaging;

  constructor(config: ConfigService) {
    const app = initializeApp({
      credential: cert({
        projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
        clientEmail: config.getOrThrow<string>('FIREBASE_CLIENT_EMAIL'),
        privateKey: config
          .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
          .replace(/\\n/g, '\n'),
      }),
    });
    this.messaging = getMessaging(app);
  }

  /** Ném lỗi nguyên văn nếu gửi thất bại — caller (processor) quyết định retry hay dọn token. */
  async send(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    await this.messaging.send({ token, notification: { title, body }, data });
    this.logger.log(`Đã gửi push tới token ...${token.slice(-8)}`);
  }
}
