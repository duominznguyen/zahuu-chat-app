import {
  BadRequestException,
  Body,
  Controller,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { UploadMediaDto } from './dto/upload-media.dto.js';
import { MediaService } from './media.service.js';

const MULTER_MAX_BYTES = 50 * 1024 * 1024;

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_MAX_BYTES },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadMediaDto,
    @UploadedFile(
      new ParseFilePipeBuilder().build({
        fileIsRequired: true,
        errorHttpStatusCode: 400,
      }),
    )
    file: Express.Multer.File,
  ) {
    if (file.size === 0) {
      throw new BadRequestException('File rỗng');
    }
    return this.mediaService.upload(user.id, dto.purpose, file);
  }
}
