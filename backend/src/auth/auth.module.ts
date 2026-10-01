import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MailModule } from '../mail/mail.module.js';
import { OtpService } from './otp.service.js';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { GoogleTokenVerifier } from './google-token.verifier.js';

const jwtModule = JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    signOptions: {
      expiresIn: config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN') as any,
    },
  }),
});

@Module({
  imports: [jwtModule, MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    GoogleTokenVerifier,
  ],
  // Export JwtModule để ChatGateway verify access token lúc handshake, dùng chung 1 cấu hình secret
  exports: [AuthService, jwtModule],
})
export class AuthModule {}
