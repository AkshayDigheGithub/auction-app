import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResolveReversalDto {
  /** Required when rejecting; optional when approving. */
  @IsOptional()
  @IsString()
  @MinLength(5)
  note?: string;
}
