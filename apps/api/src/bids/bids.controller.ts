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

  /**
   * The bid list is the customer's alone (AUC-11).
   *
   * Without the role and ownership check below, any authenticated shop owner
   * could read this for an open request and see every rival's price before
   * pricing its own bid. Blind bidding was only ever enforced by the shop UI
   * not rendering the list — one curl away from being untrue — and it is a
   * property the product states publicly, so it has to hold at the API.
   */
  @Roles('customer')
  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('requestId') requestId: string) {
    return this.bidsService.listBids(requestId, user.sub);
  }
}
