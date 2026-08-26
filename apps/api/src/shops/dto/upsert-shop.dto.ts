import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  SHOP_CATEGORIES,
  type ShopCategoryName,
} from '../../pricing/pricing.service';

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

  /**
   * Primary category. Changing this after onboarding is admin-only (see
   * ShopsService.upsertMyShop) — otherwise a shop could self-switch to
   * `jewellery` at 0.30% and take electronics deals at a third of the rate.
   */
  @IsIn(SHOP_CATEGORIES)
  category: ShopCategoryName = 'mobile_electronics';

  /** Additional categories the shop also serves (AUC-60). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(SHOP_CATEGORIES, { each: true })
  secondaryCategories?: ShopCategoryName[];

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
