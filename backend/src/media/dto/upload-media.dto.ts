import { IsEnum } from 'class-validator';
import { MediaPurpose } from '../media-purpose.enum.js';

export class UploadMediaDto {
  @IsEnum(MediaPurpose)
  purpose!: MediaPurpose;
}
