import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import ms from 'ms';

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';

function baseOptions(config: ConfigService) {
  return {
    httpOnly: true,
    // Cookie Secure không gửi được qua http:// thường — dev local không chạy HTTPS.
    secure: config.get('NODE_ENV') === 'production',
    sameSite: 'lax' as const,
  };
}

export function setSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  config: ConfigService,
) {
  const accessMaxAge = ms(
    config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN') as ms.StringValue,
  );
  const refreshMaxAge =
    Number(config.getOrThrow('REFRESH_TOKEN_TTL_DAYS')) * 24 * 60 * 60 * 1000;

  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(config),
    path: '/',
    maxAge: accessMaxAge,
  });
  // path hẹp hơn: chỉ gửi kèm khi gọi /auth/* — thu hẹp phạm vi gửi đi,
  // refresh token không cần thiết ở mọi request khác.
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(config),
    path: '/auth',
    maxAge: refreshMaxAge,
  });
}

export function clearSessionCookies(res: Response, config: ConfigService) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(config), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(config), path: '/auth' });
}
