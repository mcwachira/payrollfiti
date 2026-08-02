import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { redisStore } from 'cache-manager-redis-yet';
import Redis from 'ioredis';

import configuration, { AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { EmployeesModule } from './employees/employees.module';
import { PayrollModule } from './payroll/payroll.module';
import { PayrollCalculatorModule } from './payroll-calculator/payroll-calculator.module';
import { PayslipsModule } from './payslips/payslips.module';
import { BillingModule } from './billing/billing.module';
import { BankExportModule } from './bank-export/bank-export.module';
import { BrandingModule } from './branding/branding.module';
import { HealthModule } from './health/health.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { ComplianceReportsModule } from './compliance-reports/compliance-reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { PublicApiModule } from './public-api/public-api.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AccountingModule } from './accounting/accounting.module';
import { SalaryComponentsModule } from './salary-components/salary-components.module';
import { DocumentsModule } from './documents/documents.module';
import { LeaveModule } from './leave/leave.module';
import { HolidaysModule } from './holidays/holidays.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { LoansModule } from './loans/loans.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const isProduction =
          configService.get('nodeEnv', { infer: true }) === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isProduction ? undefined : { target: 'pino-pretty' },
            redact: [
              'req.headers.authorization',
              'req.body.password',
              'req.body.adminPassword',
              'res.body.accessToken',
              'res.body.refreshToken',
            ],
          },
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const throttle = configService.get('throttle', { infer: true });
        return { throttlers: [{ ttl: throttle.ttl, limit: throttle.limit }] };
      },
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (configService: ConfigService<AppConfig, true>) => {
        const redisUrl = configService.get('redisUrl', { infer: true });
        if (!redisUrl) {
          return {};
        }
        return { store: await redisStore({ url: redisUrl }) };
      },
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        connection: new Redis(
          configService.get('redisUrl', { infer: true }) ??
            'redis://localhost:6379',
          { maxRetriesPerRequest: null },
        ),
      }),
      inject: [ConfigService],
    }),
    TerminusModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    TenantsModule,
    EmployeesModule,
    PayrollModule,
    PayrollCalculatorModule,
    PayslipsModule,
    BillingModule,
    BankExportModule,
    BrandingModule,
    HealthModule,
    CryptoModule,
    ComplianceReportsModule,
    NotificationsModule,
    ApiKeysModule,
    PublicApiModule,
    WebhooksModule,
    AccountingModule,
    SalaryComponentsModule,
    DocumentsModule,
    LeaveModule,
    HolidaysModule,
    AttendanceModule,
    AnalyticsModule,
    LoansModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: SentryExceptionFilter },
  ],
})
export class AppModule {}
