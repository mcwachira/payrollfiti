import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantScopingExtension } from './tenant-scoping.extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super();
    // Runtime-only: shadows the tenant-scoped models' delegates with
    // extended ones (see tenant-scoping.extension.ts). Types are
    // unaffected — every existing `this.prisma.model.method()` call site
    // keeps compiling and behaves identically when there's no active
    // tenant context.
    Object.assign(this, this.$extends(tenantScopingExtension));
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
