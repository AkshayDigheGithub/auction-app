import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBidDto {
  @IsNumber()
  @Min(1)
  price!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
