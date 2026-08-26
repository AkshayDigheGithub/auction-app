import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('requests')
  requests() {
    return this.adminService.listRequests();
  }

  @Get('deals')
  deals() {
    return this.adminService.listDeals();
  }

  @Get('shops')
  shops() {
    return this.adminService.listShops();
  }

  @Put('shops/:id/verify')
  verify(@Param('id') id: string, @Body('verified') verified: boolean) {
    return this.adminService.setShopVerified(id, verified);
  }

  @Get('revenue')
  revenue() {
    return this.adminService.revenueSummary();
  }
}
