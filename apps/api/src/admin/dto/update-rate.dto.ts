import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateRateDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBps?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  capPaise?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  floorPaise?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  flatFeePaise?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Required to set a rate above the sanity threshold (AUC-66). */
  @IsOptional()
  @IsBoolean()
  confirmHighRate?: boolean;
}
