import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class VerifyClerkTokenDto {
  /**
   * The session token Clerk issues to the browser (`getToken()`).
   *
   * As with VerifyWidgetTokenDto there is deliberately no email or phoneNumber
   * field: the address is resolved from Clerk, not from the client. Accepting
   * one here would let a caller sign in as themselves and claim someone
   * else's account.
   */
  @IsString()
  @MinLength(20)
  sessionToken!: string;

  /** Only used the first time this account signs in. */
  @IsIn(['customer', 'shop_owner', 'admin'])
  role!: 'customer' | 'shop_owner' | 'admin';

  @IsOptional()
  @IsString()
  name?: string;
}
