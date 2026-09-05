import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class VerifyGoogleTokenDto {
  /**
   * The ID token Google Identity Services returns to the browser on success.
   *
   * As with VerifyWidgetTokenDto there is deliberately no email or phoneNumber
   * field: the address is read from Google's signed payload, not from the
   * client. Accepting one here would let a caller sign in as themselves and
   * claim someone else's account.
   */
  @IsString()
  @MinLength(20)
  idToken!: string;

  /** Only used the first time this account signs in. */
  @IsIn(['customer', 'shop_owner', 'admin'])
  role!: 'customer' | 'shop_owner' | 'admin';

  @IsOptional()
  @IsString()
  name?: string;
}
