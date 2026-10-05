import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, WebhookReceiver } from 'livekit-server-sdk';

// Đủ dài cho 1 cuộc gọi nhóm kéo dài, không cần refresh token giữa chừng.
const TOKEN_TTL = '4h';

interface LivekitCredentials {
  apiKey: string;
  apiSecret: string;
  url: string;
}

@Injectable()
export class LivekitService {
  constructor(private readonly config: ConfigService) {}

  get url() {
    return this.credentials().url;
  }

  async issueToken(roomName: string, identity: string) {
    const { apiKey, apiSecret } = this.credentials();
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: TOKEN_TTL,
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });
    return token.toJwt();
  }

  async receiveWebhook(rawBody: string, authHeader: string | undefined) {
    const { apiKey, apiSecret } = this.credentials();
    try {
      return await new WebhookReceiver(apiKey, apiSecret).receive(rawBody, authHeader);
    } catch {
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
    }
  }

  private credentials(): LivekitCredentials {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    const url = this.config.get<string>('LIVEKIT_URL');
    if (!apiKey || !apiSecret || !url) {
      throw new ServiceUnavailableException('Chưa cấu hình cuộc gọi (LIVEKIT_*)');
    }
    return { apiKey, apiSecret, url };
  }
}
