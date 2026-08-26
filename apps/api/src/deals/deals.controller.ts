import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DealsService } from './deals.service';
import { LockDealDto } from './dto/lock-deal.dto';
import { ScanDealDto } from './dto/scan-deal.dto';
import { ReportDealDto } from './dto/report-deal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Roles('customer')
  @Post('requests/:requestId/lock')
  lock(
    @CurrentUser() user: JwtPayload,
    @Param('requestId') requestId: string,
    @Body() dto: LockDealDto,
  ) {
    return this.dealsService.lockDeal(user.sub, requestId, dto.bidId);
  }

  @Roles('customer')
  @Get('deals/:id/qr')
  getQr(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.dealsService.getQrImage(id, user.sub);
  }

  @Roles('customer')
  @Get('deals/:id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.dealsService.getDeal(id, user.sub);
  }

  /** Customer reports they didn't buy, within the reversal window (AUC-54). */
  @Roles('customer')
  @Post('deals/:id/report-no-purchase')
  reportNoPurchase(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReportDealDto,
  ) {
    return this.dealsService.reportNoPurchase(user.sub, id, dto.reason);
  }

  @Roles('shop_owner')
  @Post('deals/scan')
  scan(@CurrentUser() user: JwtPayload, @Body() dto: ScanDealDto) {
    return this.dealsService.scanDeal(user.sub, dto.token);
  }
}
