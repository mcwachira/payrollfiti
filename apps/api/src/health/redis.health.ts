import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import type { Cache } from 'cache-manager';
import { AppConfig } from '../config/configuration';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    // Redis is a performance cache only; if it isn't configured (e.g. local
    // dev without a redis container) treat the check as a healthy no-op
    // rather than failing the whole /health endpoint.
    if (!this.configService.get('redisUrl', { infer: true })) {
      return this.getStatus(key, true, { skipped: true });
    }

    try {
      const probeKey = '__health_check__';
      await this.cache.set(probeKey, 'ok', 5000);
      const value = await this.cache.get(probeKey);
      if (value !== 'ok') {
        throw new Error('cache set/get roundtrip mismatch');
      }
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, { message: (error as Error).message }),
      );
    }
  }
}
