import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { OtpPurpose } from '../mail/mail.service.js';
import { RedisService } from '../redis/redis.service.js';

const OTP_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

interface OtpRecord<T> {
  codeHash: string;
  payload: T;
}

@Injectable()
export class OtpService {
  constructor(private readonly redis: RedisService) {}

  private key(purpose: OtpPurpose, email: string, part = 'record') {
    return `otp:${purpose}:${email}:${part}`;
  }

  private hash(purpose: OtpPurpose, email: string, code: string) {
    return createHash('sha256')
      .update(`${purpose}:${email}:${code}`)
      .digest('hex');
  }

  private async clear(purpose: OtpPurpose, email: string) {
    await this.redis.del(
      this.key(purpose, email),
      this.key(purpose, email, 'attempts'),
    );
  }

  async tryAcquireCooldown(purpose: OtpPurpose, email: string) {
    const ok = await this.redis.set(
      this.key(purpose, email, 'cooldown'),
      '1',
      'EX',
      RESEND_COOLDOWN_SECONDS,
      'NX',
    );
    return ok === 'OK';
  }

  /** Chặn spam yêu cầu gửi OTP */
  async acquireCooldown(purpose: OtpPurpose, email: string) {
    if (!(await this.tryAcquireCooldown(purpose, email))) {
      throw new HttpException(
        `Vui lòng đợi ${RESEND_COOLDOWN_SECONDS} giây trước khi yêu cầu mã mới`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Tạo mã mới, lưu kèm dữ liệu chờ (payload). Trả về mã để gửi mail. */
  async store<T>(purpose: OtpPurpose, email: string, payload: T) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const record: OtpRecord<T> = {
      codeHash: this.hash(purpose, email, code),
      payload,
    };
    await this.redis
      .multi()
      .set(
        this.key(purpose, email),
        JSON.stringify(record),
        'EX',
        OTP_TTL_SECONDS,
      )
      .set(this.key(purpose, email, 'attempts'), 0, 'EX', OTP_TTL_SECONDS)
      .exec();
    return code;
  }

  /** Gửi lại: giữ nguyên dữ liệu chờ, sinh mã mới, reset số lần thử. */
  async reissue(purpose: OtpPurpose, email: string) {
    const raw = await this.redis.get(this.key(purpose, email));
    if (!raw) {
      throw new BadRequestException('Không có yêu cầu nào đang chờ xác thực');
    }
    await this.acquireCooldown(purpose, email);
    const { payload } = JSON.parse(raw) as OtpRecord<unknown>;
    return this.store(purpose, email, payload);
  }

  /** Kiểm tra mã. Đúng thì xóa và trả lại payload; sai thì đếm lần thử. */
  async verify<T>(purpose: OtpPurpose, email: string, code: string) {
    const invalid = () =>
      new BadRequestException('Mã xác thực không đúng hoặc đã hết hạn');

    const raw = await this.redis.get(this.key(purpose, email));
    if (!raw) throw invalid();

    const attempts = await this.redis.incr(
      this.key(purpose, email, 'attempts'),
    );
    if (attempts > MAX_ATTEMPTS) {
      await this.clear(purpose, email);
      throw invalid();
    }

    const record = JSON.parse(raw) as OtpRecord<T>;
    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(this.hash(purpose, email, code), 'hex');
    if (!timingSafeEqual(expected, actual)) throw invalid();

    await this.clear(purpose, email);
    return record.payload;
  }
}
