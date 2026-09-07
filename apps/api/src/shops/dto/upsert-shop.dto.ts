import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  SHOP_CATEGORIES,
  type ShopCategoryName,
} from '../../pricing/pricing.service';

/**
 * Accepts what a shop owner actually types — "9876543210", "+91 98765 43210",
 * "091-98765-43210" — and normalises to E.164 before validation, so the column
 * holds one shape and admin search can match it. Anything else is left alone
 * for the validator to reject with a message about the phone number rather
 * than a message about a transform.
 */
function toE164Indian(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091'))
    return `+${digits.slice(1)}`;
  return value;
}

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

  /**
   * Required (AUC-89). Signing in through Clerk gives us an email and no phone,
   * but an admin still needs to call this shop to verify it exists and to work a
   * dispute. The column is nullable so shops onboarded under the OTP flow are
   * untouched; it is required *here* so no new shop is created without one.
   *
   * Not OTP-verified for the pilot — admin verification is what catches a bad
   * number, and that keeps SMS at zero. Which makes the format check the only
   * thing standing between a typo and an admin discovering it on a dead call,
   * so it is deliberately stricter than @IsPhoneNumber('IN'): that accepts
   * +911234567890, whose 1-prefix is not allocated to any Indian mobile.
   */
  @Transform(({ value }) => toE164Indian(value))
  @Matches(/^\+91[6-9]\d{9}$/, {
    message:
      'contactPhone must be a 10-digit Indian mobile number starting with 6, 7, 8 or 9',
  })
  contactPhone!: string;

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
