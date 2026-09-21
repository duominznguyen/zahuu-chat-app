import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({
      host: config.getOrThrow<string>('REDIS_HOST'),
      port: Number(config.getOrThrow('REDIS_PORT')),
    });
  }

  async onModuleInit() {
    await this.ping(); // báo lỗi khi Redis chưa run
  }

  async onModuleDestroy() {
    await this.quit();
  }
}
