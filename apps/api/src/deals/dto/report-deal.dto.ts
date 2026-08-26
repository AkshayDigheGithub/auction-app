import { IsString, MinLength } from 'class-validator';

export class ReportDealDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
