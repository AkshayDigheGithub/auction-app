import {
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

  @Get(':id')
  get(@Param('id') id: string) {
    return this.requestsService.getRequest(id);
  }
}
