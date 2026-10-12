import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module.js';
import { RedisIoAdapter } from './redis/redis-io.adapter.js';

import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const config = app.get(ConfigService);

  // LiveKit gửi webhook với Content-Type application/webhook+json, body parser mặc định
  // bỏ qua type này nên phải nhận raw buffer để xác thực chữ ký trên đúng byte gốc.
  app.use(
    '/calls/webhooks/livekit',
    express.raw({ type: 'application/webhook+json' }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((s) => s.trim()),
    credentials: true, // bắt buộc để browser gửi/nhận cookie cross-origin
  });

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(
    config.getOrThrow<string>('REDIS_HOST'),
    Number(config.getOrThrow('REDIS_PORT')),
  );
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(config.get<number>('PORT') ?? 3001);
}
await bootstrap();
