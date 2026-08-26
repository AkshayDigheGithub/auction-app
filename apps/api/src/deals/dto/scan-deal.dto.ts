import { IsString } from 'class-validator';

export class ScanDealDto {
  @IsString()
  token!: string;
}
