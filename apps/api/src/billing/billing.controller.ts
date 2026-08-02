import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BillingService } from './billing.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('billing')
@Roles(Role.ADMIN)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  listPlans(@CurrentTenant() tenantId: string) {
    return this.billingService.listPlans(tenantId);
  }

  @Post('subscribe')
  subscribe(@CurrentTenant() tenantId: string, @Body() dto: SubscribeDto) {
    return this.billingService.subscribe(tenantId, dto);
  }

  @Get('subscription')
  getSubscription(@CurrentTenant() tenantId: string) {
    return this.billingService.getSubscription(tenantId);
  }

  @Post('invoices')
  generateInvoice(
    @CurrentTenant() tenantId: string,
    @Body() dto: GenerateInvoiceDto,
  ) {
    return this.billingService.generateInvoice(tenantId, dto.period);
  }

  @Get('invoices')
  listInvoices(@CurrentTenant() tenantId: string) {
    return this.billingService.listInvoices(tenantId);
  }

  @Post('invoices/:id/pay')
  payInvoice(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: PayInvoiceDto,
  ) {
    return this.billingService.payInvoice(tenantId, id, dto);
  }
}
