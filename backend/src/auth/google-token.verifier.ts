import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();
  private readonly audiences: string[];

  constructor(config: ConfigService) {
    this.audiences = config
      .getOrThrow<string>('GOOGLE_CLIENT_IDS')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.audiences,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google token không hợp lệ');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google token không hợp lệ');
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException('Email Google chưa được xác minh');
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  }
}
