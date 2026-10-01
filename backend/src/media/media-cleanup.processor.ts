import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { MEDIA_CLEANUP_QUEUE } from './media-cleanup.queue.js';
import { MediaService } from './media.service.js';

export interface MediaCleanupJob {
  publicId: string;
  resourceType: 'image' | 'video' | 'raw';
}

@Processor(MEDIA_CLEANUP_QUEUE)
export class MediaCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaCleanupProcessor.name);

  constructor(private readonly media: MediaService) {
    super();
  }

  async process(job: Job<MediaCleanupJob>) {
    await this.media.deleteAsset(job.data.publicId, job.data.resourceType);
    this.logger.log(`Đã xóa ${job.data.publicId} trên Cloudinary`);
  }
}
