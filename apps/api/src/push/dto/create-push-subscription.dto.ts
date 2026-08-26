import { Type } from 'class-transformer';
import { IsString, MinLength, ValidateNested } from 'class-validator';

class PushSubscriptionKeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

export class CreatePushSubscriptionDto {
  @IsString()
  @MinLength(10)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}
