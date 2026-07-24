import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HealthCheckService } from '@nestjs/terminus';
import { AppController } from './app.controller';
import { PrismaHealthIndicator } from './health/prisma.health';
import { RedisHealthIndicator } from './health/redis.health';

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('AppController', () => {
  let appController: AppController;
  let healthCheckService: { check: ReturnType<typeof asyncMock> };

  beforeEach(async () => {
    healthCheckService = {
      check: asyncMock({ status: 'ok', info: {}, error: {}, details: {} }),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: PrismaHealthIndicator, useValue: { isHealthy: jest.fn() } },
        { provide: RedisHealthIndicator, useValue: { isHealthy: jest.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports ok status by delegating to Terminus HealthCheckService', async () => {
      const result = await appController.check();
      expect(result.status).toBe('ok');
      expect(healthCheckService.check).toHaveBeenCalledTimes(1);
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
      ]);
    });
  });
});
