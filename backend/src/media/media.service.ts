import {
  ForbiddenException,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  type UploadApiOptions,
  type UploadApiResponse,
} from 'cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { MediaPurpose } from './media-purpose.enum.js';

type MediaCategory = 'image' | 'video' | 'file';
type ResourceType = 'image' | 'video' | 'raw';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const FILE_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/zip',
]);

// Các purpose chỉ nhận ảnh
const IMAGE_ONLY_PURPOSES = new Set<MediaPurpose>([
  MediaPurpose.AVATAR,
  MediaPurpose.COVER,
  MediaPurpose.GROUP_AVATAR,
  MediaPurpose.BACKGROUND,
]);

@Injectable()
export class MediaService {
  private readonly cloudName: string;
  private readonly folder: string;

  constructor(private readonly config: ConfigService) {
    this.cloudName = config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME');
    this.folder = config.getOrThrow<string>('CLOUDINARY_FOLDER');
    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async upload(userId: string, purpose: MediaPurpose, file: Express.Multer.File) {
    const detected = await fileTypeFromBuffer(file.buffer);
    const category = detected ? this.categoryOf(detected.mime) : null;
    if (!category) {
      throw new UnsupportedMediaTypeException('Định dạng file không được hỗ trợ');
    }
    if (category !== 'image' && IMAGE_ONLY_PURPOSES.has(purpose)) {
      throw new UnsupportedMediaTypeException(`${purpose} chỉ chấp nhận ảnh`);
    }

    const maxBytes = this.maxBytesFor(category);
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `File vượt quá dung lượng cho phép (${maxBytes / (1024 * 1024)}MB)`,
      );
    }

    const resourceType: ResourceType = category === 'file' ? 'raw' : category;
    // raw (file) giữ đuôi file trong publicId để tải đúng định dạng;
    // image/video Cloudinary auto sinh
    const suffix = category === 'file' ? `.${detected!.ext}` : '';
    const publicId = `${this.folder}/${purpose}/${userId}/${randomUUID()}${suffix}`;

    const result = await this.uploadBuffer(file.buffer, {
      public_id: publicId,
      resource_type: resourceType,
      overwrite: false,
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType,
      bytes: result.bytes,
      originalName: file.originalname,
    };
  }

  /**
   * Xác nhận url/publicId thuộc đúng user + purpose, trước khi lưu vào DB
   * hoặc trước khi xóa. 
   * Dùng cho avatar/cover/background (chỉ có url) và message (có cả url lẫn publicId).
   */
  assertOwnedMedia(
    userId: string,
    purpose: MediaPurpose,
    url: string,
    publicId?: string,
  ) {
    const invalid = () =>
      new ForbiddenException('URL media không hợp lệ hoặc không thuộc về bạn');

    if (!url.startsWith(`https://res.cloudinary.com/${this.cloudName}/`)) {
      throw invalid();
    }

    const expectedPrefix = `${this.folder}/${purpose}/${userId}/`;
    if (publicId) {
      if (!publicId.startsWith(expectedPrefix)) throw invalid();
      if (!url.includes(publicId)) throw invalid();
    } else if (!url.includes(expectedPrefix)) {
      throw invalid();
    }
  }

  async deleteAsset(publicId: string, resourceType: ResourceType) {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }

  private categoryOf(mime: string): MediaCategory | null {
    if (IMAGE_MIMES.has(mime)) return 'image';
    if (VIDEO_MIMES.has(mime)) return 'video';
    if (FILE_MIMES.has(mime)) return 'file';
    return null;
  }

  private maxBytesFor(category: MediaCategory) {
    const key =
      category === 'image'
        ? 'MEDIA_MAX_IMAGE_MB'
        : category === 'video'
          ? 'MEDIA_MAX_VIDEO_MB'
          : 'MEDIA_MAX_FILE_MB';
    return Number(this.config.getOrThrow(key)) * 1024 * 1024;
  }

  private uploadBuffer(buffer: Buffer, options: UploadApiOptions) {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload thất bại'));
        resolve(result);
      });
      Readable.from(buffer).pipe(stream);
    });
  }
}
