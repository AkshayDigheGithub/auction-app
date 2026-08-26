import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ShopsService } from './shops.service';
import { UpsertShopDto } from './dto/upsert-shop.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

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
}
