import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class VerifyWidgetTokenDto {
  /**
   * The JWT MSG91's OTP widget returns to the browser on success.
   *
   * Note there is deliberately no phoneNumber field: the number is read from
   * MSG91's verification response, not from the client. Accepting one here
   * would let a caller verify their own phone and claim someone else's.
   */
  @IsString()
  @MinLength(20)
  accessToken!: string;

  /** Only used the first time this phone number logs in. */
  @IsIn(['customer', 'shop_owner', 'admin'])
  role!: 'customer' | 'shop_owner' | 'admin';

  @IsOptional()
  @IsString()
  name?: string;
}
