import { ArrayUnique, IsArray, IsIn, IsOptional } from 'class-validator';
import {
  SHOP_CATEGORIES,
  type ShopCategoryName,
} from '../../pricing/pricing.service';

export class UpdateShopCategoriesDto {
  @IsOptional()
  @IsIn(SHOP_CATEGORIES)
  category?: ShopCategoryName;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(SHOP_CATEGORIES, { each: true })
  secondaryCategories?: ShopCategoryName[];
}
