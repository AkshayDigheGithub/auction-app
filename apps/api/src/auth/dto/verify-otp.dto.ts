import { IsIn, IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsPhoneNumber('IN')
  phoneNumber!: string;

  @IsString()
  @Length(4, 8)
  code!: string;

  /** Only used the first time this phone number logs in — see AuthService for the admin self-signup guard. */
  @IsIn(['customer', 'shop_owner', 'admin'])
  role!: 'customer' | 'shop_owner' | 'admin';

  @IsOptional()
  @IsString()
  name?: string;
}
