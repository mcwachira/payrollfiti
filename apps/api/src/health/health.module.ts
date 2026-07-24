import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@Module({
  imports: [TerminusModule],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
  exports: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
