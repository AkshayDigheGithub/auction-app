import { IsIn, IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertShopDto {
  @IsString()
  @MinLength(2)
  shopName!: string;

  @IsString()
  @MinLength(5)
  address!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsIn(['mobile_electronics'])
  category: 'mobile_electronics' = 'mobile_electronics';

  @IsOptional()
  @IsString()
  upiId?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;
}
