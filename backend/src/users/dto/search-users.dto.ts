import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SearchUsersDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase().replace(/^@/, '')
      : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_.]+$/, {
    message: 'q chỉ gồm chữ thường, số, dấu chấm và gạch dưới',
  })
  q!: string;
}
