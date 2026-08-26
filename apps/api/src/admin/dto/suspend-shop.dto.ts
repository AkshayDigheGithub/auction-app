import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class SuspendShopDto {
  @IsBoolean()
  suspended!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(5)
  reason?: string;
}
