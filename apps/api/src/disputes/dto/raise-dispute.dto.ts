import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { DisputeReason } from '../../../generated/prisma/client.js';

const ALL_REASONS: DisputeReason[] = [
  'bid_not_honoured',
  'price_higher_in_shop',
  'item_not_available',
  'shop_unreachable',
  'customer_no_show',
  'conduct',
  'other',
];

export class RaiseDisputeDto {
  /**
   * Validated against the full list here and against what this side is allowed
   * to say in DisputesService — the DTO cannot know which party is calling.
   */
  @IsIn(ALL_REASONS)
  reason!: DisputeReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
