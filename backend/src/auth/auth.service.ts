import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuthProviderType } from '../generated/prisma/enums.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResendOtpDto } from './dto/resend-otp.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { OtpService } from './otp.service.js';
import { generateUniqueUsername } from './utils/username.util.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { GoogleAuthDto } from './dto/google-auth.dto.js';
import { GoogleTokenVerifier } from './google-token.verifier.js';

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

interface PendingRegistration {
  passwordHash: string;
  displayName: string;
}

const isUniqueViolation = (e: unknown) =>
  typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly googleVerifier: GoogleTokenVerifier,
  ) {}

  /** Lưu dữ liệu user chờ ở Redis và gửi OTP xác nhận email. */
  async register(dto: RegisterDto) {
    await this.assertEmailAvailable(dto.email);

    await this.otp.acquireCooldown('REGISTER', dto.email);
    const pending: PendingRegistration = {
      passwordHash: await hash(dto.password),
      displayName: dto.displayName,
    };
    const code = await this.otp.store('REGISTER', dto.email, pending);
    await this.mail.sendOtp(dto.email, code, 'REGISTER');

    return { message: 'Đã gửi mã xác thực tới email', resendAfterSeconds: 60 };
  }

  async resendOtp(dto: ResendOtpDto) {
    await this.assertEmailAvailable(dto.email);
    const code = await this.otp.reissue('REGISTER', dto.email);
    await this.mail.sendOtp(dto.email, code, 'REGISTER');
    return { message: 'Đã gửi lại mã xác thực', resendAfterSeconds: 60 };
  }

  /** Bước 2: OTP đúng thì mới tạo User. */
  async verifyEmail(dto: VerifyEmailDto) {
    const pending = await this.otp.verify<PendingRegistration>(
      'REGISTER',
      dto.email,
      dto.otp,
    );

    const userId = randomUUID();
    const username = await generateUniqueUsername(
      this.prisma,
      dto.email.split('@')[0],
    );

    try {
      const user = await this.prisma.user.create({
        data: {
          id: userId,
          username,
          displayName: pending.displayName,
          email: dto.email,
          passwordHash: pending.passwordHash,
          authProviders: {
            create: {
              provider: AuthProviderType.LOCAL,
              providerAccountId: userId,
            },
          },
        },
        select: publicUserSelect,
      });
      return { user, ...(await this.issueTokens(user.id)) };
    } catch (e) {
      // catch lỗi khi chờ OTP, email này có thể đã được đăng ký (ví dụ bằng Google)
      if (isUniqueViolation(e)) await this.assertEmailAvailable(dto.email);
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    const valid =
      user?.passwordHash &&
      !user.deactivatedAt &&
      (await verify(user.passwordHash, dto.password));
    if (!user || !valid) {
      throw new UnauthorizedException('Sai thông tin đăng nhập');
    }

    const { id, username, displayName, avatarUrl } = user;
    return {
      user: { id, username, displayName, avatarUrl },
      ...(await this.issueTokens(user.id)),
    };
  }

  async googleLogin(dto: GoogleAuthDto) {
    const profile = await this.googleVerifier.verify(dto.idToken);
    const select = { ...publicUserSelect, deactivatedAt: true } as const;

    // Đã từng đăng nhập Google bằng tài khoản Google này
    const linked = await this.prisma.authProvider.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProviderType.GOOGLE,
          providerAccountId: profile.sub,
        },
      },
      select: { user: { select } },
    });

    let user = linked?.user;

    if (!user) {
      const existing = await this.prisma.user.findUnique({
        where: { email: profile.email },
        select,
      });

      try {
        if (existing) {
          // Email trùng tài khoản đã có -> liên kết thêm Google
          await this.prisma.authProvider.create({
            data: {
              userId: existing.id,
              provider: AuthProviderType.GOOGLE,
              providerAccountId: profile.sub,
            },
          });
          user = existing;
        } else {
          // Chưa có -> tạo tài khoản mới
          user = await this.prisma.user.create({
            data: {
              username: await generateUniqueUsername(
                this.prisma,
                profile.email.split('@')[0],
              ),
              displayName: profile.name ?? profile.email.split('@')[0],
              email: profile.email,
              avatarUrl: profile.picture,
              authProviders: {
                create: {
                  provider: AuthProviderType.GOOGLE,
                  providerAccountId: profile.sub,
                },
              },
            },
            select,
          });
        }
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new ConflictException('Vui lòng thử đăng nhập lại');
        }
        throw e;
      }
    }

    if (user.deactivatedAt) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    const { id, username, displayName, avatarUrl } = user;
    return {
      user: { id, username, displayName, avatarUrl },
      ...(await this.issueTokens(user.id)),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const response = {
      message: 'Nếu email đã đăng ký, mã đặt lại mật khẩu đã được gửi',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, deactivatedAt: true },
    });
    if (!user || user.deactivatedAt) return response;

    if (!(await this.otp.tryAcquireCooldown('RESET_PASSWORD', dto.email))) {
      return response;
    }

    const code = await this.otp.store('RESET_PASSWORD', dto.email, {
      userId: user.id,
    });
    await this.mail.sendOtp(dto.email, code, 'RESET_PASSWORD');
    return response;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { userId } = await this.otp.verify<{ userId: string }>(
      'RESET_PASSWORD',
      dto.email,
      dto.otp,
    );
    const passwordHash = await hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.authProvider.upsert({
        where: {
          provider_providerAccountId: {
            provider: AuthProviderType.LOCAL,
            providerAccountId: userId,
          },
        },
        create: {
          userId,
          provider: AuthProviderType.LOCAL,
          providerAccountId: userId,
        },
        update: {},
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Đã đặt lại mật khẩu, vui lòng đăng nhập lại' };
  }

  async refresh(dto: RefreshTokenDto) {
    const invalid = () =>
      new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(dto.refreshToken) },
      include: { user: { select: { deactivatedAt: true } } },
    });
    if (!stored) throw invalid();

    if (stored.revokedAt) {
      // Revoke tocken khi có người sử dụng token cũ để xác thực
      if (stored.replacedBy) await this.revokeAllTokens(stored.userId);
      throw invalid();
    }
    if (stored.expiresAt <= new Date() || stored.user.deactivatedAt) {
      throw invalid();
    }

    const next = this.generateRefreshToken();
    const newId = randomUUID();

    const rotated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedBy: newId },
      });
      if (count === 0) return false;

      await tx.refreshToken.create({
        data: {
          id: newId,
          userId: stored.userId,
          tokenHash: next.tokenHash,
          expiresAt: next.expiresAt,
        },
      });
      return true;
    });

    if (!rotated) {
      await this.revokeAllTokens(stored.userId);
      throw invalid();
    }

    const accessToken = await this.jwt.signAsync({ sub: stored.userId });
    return { accessToken, refreshToken: next.token };
  }

  async logout(dto: RefreshTokenDto) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(dto.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private revokeAllTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async assertEmailAvailable(email: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: {
        passwordHash: true,
        authProviders: { select: { provider: true } },
      },
    });
    if (!existing) return;

    const methods: string[] = [];
    if (existing.passwordHash) methods.push('PASSWORD');
    if (
      existing.authProviders.some((p) => p.provider === AuthProviderType.GOOGLE)
    ) {
      methods.push('GOOGLE');
    }
    throw new ConflictException({
      statusCode: 409,
      code: 'EMAIL_EXISTS',
      message: 'Email đã được đăng ký',
      methods,
    });
  }

  private generateRefreshToken() {
    const token = randomBytes(48).toString('base64url');
    const ttlDays = Number(this.config.getOrThrow('REFRESH_TOKEN_TTL_DAYS'));
    return {
      token,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
    };
  }

  private async issueTokens(userId: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId });
    const { token, tokenHash, expiresAt } = this.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
    return { accessToken, refreshToken: token };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
