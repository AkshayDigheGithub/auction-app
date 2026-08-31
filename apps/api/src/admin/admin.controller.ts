import {
  Body,
  Controller,
  Get,
  Header,
  Ip,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { toCsv, flatten } from './csv.util';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.interface';
import type { ShopCategoryName } from '../pricing/pricing.service';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';
import { UpdateRateDto } from './dto/update-rate.dto';
import { SuspendShopDto } from './dto/suspend-shop.dto';
import { UpdateShopCategoriesDto } from './dto/update-shop-categories.dto';
import { ResolveReversalDto } from './dto/resolve-reversal.dto';
import {
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
} from './dto/product-category.dto';

const num = (v?: string) => (v == null || v === '' ? undefined : Number(v));
const bool = (v?: string) => (v == null || v === '' ? undefined : v === 'true');

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ------------------------------------------------------------- listings

  @Get('requests')
  requests(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('productCategoryId') productCategoryId?: string,
    @Query('reachedNobody') reachedNobody?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.listRequests({
      q,
      status,
      productCategoryId,
      reachedNobody: bool(reachedNobody),
      from,
      to,
      skip: num(skip),
      take: num(take),
    });
  }

  @Get('deals')
  deals(
    @Query('feeStatus') feeStatus?: string,
    @Query('qrStatus') qrStatus?: string,
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.listDeals({
      feeStatus,
      qrStatus,
      category,
      from,
      to,
      skip: num(skip),
      take: num(take),
    });
  }

  @Get('shops')
  shops(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('lowBalance') lowBalance?: string,
    @Query('suspended') suspended?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.listShops({
      q,
      category,
      lowBalance: bool(lowBalance),
      suspended: bool(suspended),
      skip: num(skip),
      take: num(take),
    });
  }

  @Get('users')
  users(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.listUsers({
      q,
      role,
      from,
      to,
      skip: num(skip),
      take: num(take),
    });
  }

  // --------------------------------------------------------------- export

  /** CSV export respecting the same filters as the list views (AUC-71). */
  @Get('export/:resource')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Param('resource') resource: string,
    @Query() query: Record<string, string>,
  ) {
    const opts = {
      ...query,
      skip: num(query.skip),
      take: num(query.take) ?? 5000,
    };
    let rows: Array<Record<string, unknown>>;

    switch (resource) {
      case 'requests':
        rows = (await this.adminService.listRequests(opts)).rows;
        break;
      case 'deals':
        rows = (await this.adminService.listDeals(opts)).rows;
        break;
      case 'shops':
        rows = (await this.adminService.listShops(opts)).rows;
        break;
      case 'users':
        rows = (await this.adminService.listUsers(opts)).rows;
        break;
      case 'ledger':
        rows = (await this.adminService.shopLedger(query.shopId, opts)).rows;
        break;
      case 'audit':
        rows = (await this.adminService.auditLog(opts)).rows;
        break;
      default:
        rows = [];
    }

    return toCsv(rows.map((r) => flatten(r)));
  }

  // ----------------------------------------------------------- shop detail

  @Get('shops/:id')
  shopDetail(@Param('id') id: string) {
    return this.adminService.shopDetail(id);
  }

  @Put('shops/:id/verify')
  verify(
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Param('id') id: string,
    @Body('verified') verified: boolean,
  ) {
    return this.adminService.setShopVerified(id, verified, {
      actorUserId: user.sub,
      ip,
    });
  }

  @Put('shops/:id/suspend')
  suspend(
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Param('id') id: string,
    @Body() dto: SuspendShopDto,
  ) {
    return this.adminService.setShopSuspended(
      id,
      dto.suspended,
      dto.reason ?? null,
      {
        actorUserId: user.sub,
        ip,
      },
    );
  }

  @Put('shops/:id/categories')
  updateCategories(
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Param('id') id: string,
    @Body() dto: UpdateShopCategoriesDto,
  ) {
    return this.adminService.updateShopCategories(id, dto, {
      actorUserId: user.sub,
      ip,
    });
  }

  // --------------------------------------------------------------- wallet

  @Get('shops/:id/ledger')
  ledger(
    @Param('id') id: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.shopLedger(id, {
      type,
      from,
      to,
      skip: num(skip),
      take: num(take),
    });
  }

  @Post('shops/:id/wallet/adjust')
  adjustWallet(
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Param('id') id: string,
    @Body() dto: AdjustWalletDto,
  ) {
    return this.adminService.adjustWallet(id, dto, {
      actorUserId: user.sub,
      ip,
    });
  }

  @Get('wallet/totals')
  walletTotals() {
    return this.adminService.walletTotals();
  }

  // ---------------------------------------------------------------- rates

  @Get('rates')
  rates() {
    return this.adminService.listRates();
  }

  @Put('rates/:category')
  updateRate(
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Param('category') category: string,
    @Body() dto: UpdateRateDto,
  ) {
    return this.adminService.updateRate(category as ShopCategoryName, dto, {
      actorUserId: user.sub,
      ip,
    });
  }

  // -------------------------------------------------------------- revenue

  @Get('revenue')
  revenue(@Query('from') from?: string, @Query('to') to?: string) {
    return this.adminService.revenueSummary({ from, to });
  }

  @Get('revenue/daily')
  revenueDaily(@Query('days') days?: string) {
    return this.adminService.revenueByDay(num(days) ?? 30);
  }

  // -------------------------------------------------------------- leakage

  @Get('leakage')
  leakage(@Query('days') days?: string, @Query('minDeals') minDeals?: string) {
    return this.adminService.leakageByShop({
      days: num(days),
      minDeals: num(minDeals),
    });
  }

  @Get('leakage/trend')
  leakageTrend(@Query('days') days?: string) {
    return this.adminService.leakageTrend(num(days) ?? 30);
  }

  // ------------------------------------------------------------ reversals

  @Get('reversals')
  reversals(
    @Query('status') status?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.listReversals({
      status,
      skip: num(skip),
      take: num(take),
    });
  }

  @Post('reversals/:id/approve')
  approveReversal(
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Param('id') id: string,
    @Body() dto: ResolveReversalDto,
  ) {
    return this.adminService.approveReversal(id, dto.note ?? '', {
      actorUserId: user.sub,
      ip,
    });
  }

  @Post('reversals/:id/reject')
  rejectReversal(
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Param('id') id: string,
    @Body() dto: ResolveReversalDto,
  ) {
    return this.adminService.rejectReversal(id, dto.note ?? '', {
      actorUserId: user.sub,
      ip,
    });
  }

  // ----------------------------------------------------- product categories

  @Get('product-categories')
  productCategories() {
    return this.adminService.listProductCategories();
  }

  @Post('product-categories')
  createProductCategory(
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Body() dto: CreateProductCategoryDto,
  ) {
    return this.adminService.createProductCategory(dto, {
      actorUserId: user.sub,
      ip,
    });
  }

  @Put('product-categories/:id')
  updateProductCategory(
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.adminService.updateProductCategory(id, dto, {
      actorUserId: user.sub,
      ip,
    });
  }

  @Put('product-categories/:id/active')
  setProductCategoryActive(
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
    @Param('id') id: string,
    @Body('active') active: boolean,
  ) {
    return this.adminService.setProductCategoryActive(id, active, {
      actorUserId: user.sub,
      ip,
    });
  }

  // --------------------------------------------------------- trial + audit

  @Get('trial-cohorts')
  trialCohorts() {
    return this.adminService.trialCohorts();
  }

  @Get('audit')
  audit(
    @Query('actorUserId') actorUserId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.auditLog({
      actorUserId,
      action,
      targetType,
      targetId,
      from,
      to,
      skip: num(skip),
      take: num(take),
    });
  }
}
