import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
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
