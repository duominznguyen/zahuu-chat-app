import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DeviceTokensController } from './device-tokens.controller.js';
import { FCM_SEND_QUEUE } from './fcm-send.queue.js';
import { FcmSendProcessor } from './fcm-send.processor.js';
import { FcmService } from './fcm.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: FCM_SEND_QUEUE })],
  controllers: [NotificationsController, DeviceTokensController],
  providers: [NotificationsService, FcmService, FcmSendProcessor],
})
export class NotificationsModule {}
