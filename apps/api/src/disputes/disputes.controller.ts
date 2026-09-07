import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { RaiseDisputeDto } from './dto/raise-dispute.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.interface';

/**
 * The two sides of a deal raising conduct disputes (AUC-34). Admin resolution
 * lives on AdminController with the rest of the admin surface.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Roles('customer', 'shop_owner')
  @Post('deals/:id/disputes')
  raise(
    @CurrentUser() user: JwtPayload,
    @Param('id') dealId: string,
    @Body() dto: RaiseDisputeDto,
  ) {
    return this.disputes.raise({
      userId: user.sub,
      role: user.role as 'customer' | 'shop_owner',
      dealId,
      reason: dto.reason,
      details: dto.details,
    });
  }

  /** Whether this viewer can raise one, and which reasons they may pick. */
  @Roles('customer', 'shop_owner')
  @Get('deals/:id/disputes/context')
  context(@CurrentUser() user: JwtPayload, @Param('id') dealId: string) {
    return this.disputes.disputeContext(
      dealId,
      user.sub,
      user.role as 'customer' | 'shop_owner',
    );
  }

  @Roles('customer', 'shop_owner')
  @Get('disputes/mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.disputes.listMine(user.sub);
  }
}
