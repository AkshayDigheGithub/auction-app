import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Roles('customer')
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRequestDto) {
    return this.requestsService.createRequest(user.sub, dto);
  }

  @Roles('customer')
  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.requestsService.listMyRequests(user.sub);
  }

  @Roles('shop_owner')
  @Get('nearby')
  nearby(
    @CurrentUser() user: JwtPayload,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.requestsService.findOpenNearby(
      user.sub,
      Number(latitude),
      Number(longitude),
      radiusKm ? Number(radiusKm) : undefined,
    );
  }

  /**
   * Anonymised supply density for the pre-post screen (AUC-93).
   *
   * Deliberately a count and nothing more — no names, no addresses, no paging.
   * There is no offset/limit here because there is no list to page: the shape of
   * the response is what stops this becoming an enumerable shop directory, and
   * a directory would let a customer skip the auction entirely.
   *
   * Declared above the `:id` route because Nest matches in declaration order and
   * would otherwise read "nearby-shop-count" as a request id.
   */
  @Roles('customer')
  @Get('nearby-shop-count')
  nearbyShopCount(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('productCategoryId') productCategoryId?: string,
  ) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    // The geography query treats a NaN bind param as an error deep in PostGIS;
    // reject it here so a missing query string reads as a bad request rather
    // than a 500.
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new BadRequestException('latitude must be between -90 and 90');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException('longitude must be between -180 and 180');
    }
    return this.requestsService.countNearbyShops(
      lat,
      lng,
      productCategoryId || undefined,
    );
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.requestsService.getRequest(id);
  }
}
