import { IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @MinLength(2)
  productName!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(2)
  areaText!: string;

  /** From browser geolocation, when available — skips the geocoding round-trip. */
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  radiusKm?: number;
}
