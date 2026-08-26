import { IsInt, IsString, MinLength, NotEquals } from 'class-validator';

export class AdjustWalletDto {
  /** Signed paise: positive credits, negative debits. */
  @IsInt()
  @NotEquals(0)
  amountPaise!: number;

  /** Mandatory — an unexplained money movement is not auditable (AUC-64). */
  @IsString()
  @MinLength(5)
  reason!: string;
}
