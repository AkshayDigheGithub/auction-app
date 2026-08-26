import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ShopsService } from './shops.service';
import { UpsertShopDto } from './dto/upsert-shop.dto';
import { PushService } from '../push/push.service';
import { CreatePushSubscriptionDto } from '../push/dto/create-push-subscription.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shops')
export class ShopsController {
  constructor(
    private readonly shopsService: ShopsService,
    private readonly pushService: PushService,
  ) {}

  @Roles('shop_owner')
  @Put('me')
  upsertMyShop(@CurrentUser() user: JwtPayload, @Body() dto: UpsertShopDto) {
    return this.shopsService.upsertMyShop(user.sub, dto);
  }

  @Roles('shop_owner')
  @Get('me')
  getMyShop(@CurrentUser() user: JwtPayload) {
    return this.shopsService.getMyShop(user.sub);
  }

  /** Registers a device for Web Push notifications on new nearby requests (AUC-21). */
  @Roles('shop_owner')
  @Post('me/push-subscription')
  async subscribeToPush(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePushSubscriptionDto,
  ) {
    const shop = await this.shopsService.getMyShop(user.sub);
    await this.pushService.subscribe(shop.id, dto);
    return { ok: true };
  }

  @Roles('shop_owner')
  @Delete('me/push-subscription')
  async unsubscribeFromPush(@Body('endpoint') endpoint: string) {
    await this.pushService.unsubscribe(endpoint);
    return { ok: true };
  }
}
