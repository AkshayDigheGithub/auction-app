import {
  Controller,
  Get,
  NotFoundException,
  NotImplementedException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { getBillingMode } from '../pricing/billing-mode';
import { MIN_CUSTOM_RECHARGE_PAISE, RECHARGE_SLABS } from './recharge-slabs';
import { FREE_DEALS_PER_SHOP } from '../deals/billing.constants';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('shop_owner')
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly pricing: PricingService,
    private readonly prisma: PrismaService,
  ) {}

  private async myShop(ownerUserId: string) {
    const shop = await this.prisma.db.shop.findUnique({
      where: { ownerUserId },
    });
    if (!shop) throw new NotFoundException('Create your shop profile first');
    return shop;
  }

  /** Balance, trial state and what it costs to win a deal (AUC-48 / AUC-52). */
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const shop = await this.myShop(user.sub);
    const category = shop.category;
    const [rule, maxFeePaise] = await Promise.all([
      this.pricing.getRule(category),
      this.pricing.maxFeePaise(category),
    ]);

    const freeDealsRemaining = Math.max(
      FREE_DEALS_PER_SHOP - shop.freeDealsUsed,
      0,
    );
    const billingMode = getBillingMode();

    return {
      shopId: shop.id,
      category,
      billingMode,
      balancePaise: shop.walletBalancePaise,
      freeDealsRemaining,
      freeDealsTotal: FREE_DEALS_PER_SHOP,
      suspended: shop.suspended,
      pricing: {
        rateBps: rule.rateBps,
        capPaise: rule.capPaise,
        floorPaise: rule.floorPaise,
        flatFeePaise: rule.flatFeePaise,
        maxFeePaise,
      },
      // In shadow mode nothing is charged, so nothing can gate matching either.
      eligibleForLeads:
        !shop.suspended &&
        (billingMode === 'shadow' ||
          freeDealsRemaining > 0 ||
          shop.walletBalancePaise >= maxFeePaise),
      rechargeSlabs: RECHARGE_SLABS,
      minCustomRechargePaise: MIN_CUSTOM_RECHARGE_PAISE,
    };
  }

  @Get('me/ledger')
  async ledger(
    @CurrentUser() user: JwtPayload,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const shop = await this.myShop(user.sub);
    return this.wallet.ledger(shop.id, {
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
  }

  /**
   * Recharge is deliberately not wired up (BACKLOG-monetization.md §0).
   *
   * Taking money from shops requires the GST position (AUC-74) and the wallet
   * refund policy (AUC-75) to be settled first. Everything downstream of a
   * credit — ledger, gating, fees, reversals — is built and exercised by
   * `AdminService.adjustWallet`, so switching this on later is a contained
   * change: implement the Razorpay order + webhook, then call
   * `WalletService.credit`.
   */
  @Post('me/recharge')
  recharge(): never {
    throw new NotImplementedException(
      'Wallet recharge is not enabled yet. Collecting money from shops is blocked on the GST position (AUC-74) and the wallet refund policy (AUC-75). Admin can credit a wallet manually in the meantime.',
    );
  }
}
