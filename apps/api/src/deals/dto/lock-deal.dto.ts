import { IsString } from 'class-validator';

export class LockDealDto {
  @IsString()
  bidId!: string;
}
