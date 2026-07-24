import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrandingConfigDto } from '@repo/api';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  getDefaultBranding(): BrandingConfigDto {
    return { appName: this.configService.get('appName', { infer: true }) };
  }

  async getBranding(tenantId: string): Promise<BrandingConfigDto> {
    const config = await this.prisma.brandingConfig.findUnique({
      where: { tenantId },
    });
    return {
      appName:
        config?.appName ?? this.configService.get('appName', { infer: true }),
      logoUrl: config?.logoUrl,
      primaryColor: config?.primaryColor,
      secondaryColor: config?.secondaryColor,
    };
  }

  upsertBranding(tenantId: string, dto: UpdateBrandingDto) {
    return this.prisma.brandingConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: { ...dto },
    });
  }
}
