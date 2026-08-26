import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BidsService } from './bids.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests/:requestId/bids')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @Roles('shop_owner')
  @Post()
  submit(@CurrentUser() user: JwtPayload, @Param('requestId') requestId: string, @Body() dto: CreateBidDto) {
    return this.bidsService.submitBid(user.sub, requestId, dto);
  }

  @Get()
  list(@Param('requestId') requestId: string) {
    return this.bidsService.listBids(requestId);
  }
}
