import { IsIn } from 'class-validator';

export const ALLOWED_REACTIONS = [
  'like',
  'love',
  'haha',
  'wow',
  'sad',
  'angry',
] as const;

export class SetReactionDto {
  @IsIn(ALLOWED_REACTIONS)
  reactionType!: (typeof ALLOWED_REACTIONS)[number];
}
