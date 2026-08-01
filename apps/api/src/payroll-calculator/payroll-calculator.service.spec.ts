import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getCountryRuleSet } from '@repo/payroll-rules';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { RulesCacheService } from '../payroll/rules-cache.service';

describe('PayrollCalculatorService', () => {
  let service: PayrollCalculatorService;
  let rulesCache: { resolve: jest.Mock<(...args: any[]) => Promise<any>> };

  beforeEach(async () => {
    rulesCache = {
      resolve: jest
        .fn<(...args: any[]) => Promise<any>>()
        .mockImplementation(async (countryCode: string) =>
          getCountryRuleSet(countryCode),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollCalculatorService,
        { provide: RulesCacheService, useValue: rulesCache },
      ],
    }).compile();

    service = module.get(PayrollCalculatorService);
  });

  describe('listSupportedCountries', () => {
    it('lists KE, NG, ZA with their currency and rule version', () => {
      const countries = service.listSupportedCountries();
      const codes = countries.map((c) => c.countryCode).sort();
      expect(codes).toEqual(['KE', 'NG', 'ZA']);
      expect(countries.find((c) => c.countryCode === 'KE')?.currency).toBe(
        'KES',
      );
    });
  });

  describe('calculate', () => {
    it('computes a Kenya breakdown with statutory deductions and PAYE', async () => {
      const result = await service.calculate({
        country: 'KE',
        salary: 80_000,
      });

      expect(result.countryCode).toBe('KE');
      expect(result.currency).toBe('KES');
      expect(result.grossPay).toBe(80_000);
      expect(result.statutoryDeductions.map((d) => d.code).sort()).toEqual(
        ['HOUSING_LEVY', 'NHIF', 'NSSF'].sort(),
      );
      expect(result.netPay).toBeLessThan(result.grossPay);
      expect(result.netPay).toBeGreaterThan(0);
    });

    it('lowercase country codes are normalized', async () => {
      const result = await service.calculate({ country: 'ke', salary: 50_000 });
      expect(result.countryCode).toBe('KE');
    });

    it('includes allowances in gross pay', async () => {
      const result = await service.calculate({
        country: 'NG',
        salary: 100_000,
        allowances: { transport: 10_000, housing: 20_000 },
      });
      expect(result.grossPay).toBe(130_000);
    });

    it('rejects an unsupported country', async () => {
      await expect(
        service.calculate({ country: 'US', salary: 50_000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a negative allowance amount', async () => {
      await expect(
        service.calculate({
          country: 'KE',
          salary: 50_000,
          allowances: { transport: -100 },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
