import { Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { CallsService } from './calls.service.js';
import { LivekitService } from './livekit.service.js';

// Không phải client gọi: LiveKit Cloud POST về đây khi có sự kiện phòng/người tham gia.
// Chữ ký được xác thực trên đúng byte gốc, route này được parse raw trong main.ts.
@Controller('calls/webhooks')
export class CallsWebhookController {
  constructor(
    private readonly livekit: LivekitService,
    private readonly calls: CallsService,
  ) {}

  @Public()
  @Post('livekit')
  @HttpCode(HttpStatus.OK)
  async handle(@Req() req: Request) {
    const event = await this.livekit.receiveWebhook(
      Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '',
      req.get('authorization'),
    );

    if (event.event === 'participant_left' && event.room?.name && event.participant?.identity) {
      await this.calls.handleParticipantLeft(event.room.name, event.participant.identity);
    } else if (event.event === 'room_finished' && event.room?.name) {
      await this.calls.handleRoomFinished(event.room.name);
    }
  }
}
