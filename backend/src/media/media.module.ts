import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MediaCleanupProcessor } from './media-cleanup.processor.js';
import { MEDIA_CLEANUP_QUEUE } from './media-cleanup.queue.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: MEDIA_CLEANUP_QUEUE })],
  controllers: [MediaController],
  providers: [MediaService, MediaCleanupProcessor],
  // Export BullModule để module khác (Messages) inject được Queue và enqueue job,
  // không gọi thẳng MediaService.deleteAsset.
  exports: [MediaService, BullModule],
})
export class MediaModule {}
