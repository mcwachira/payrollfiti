import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PayrollCalculationInput,
  PayrollCalculationResult,
  getCountryRuleSet,
  getSupportedCountries,
  runPayrollCalculation,
} from '@repo/payroll-rules';
import { RulesCacheService } from '../payroll/rules-cache.service';
import { CalculatePayrollDto } from './dto/calculate-payroll.dto';

export interface SupportedCountry {
  countryCode: string;
  currency: string;
  ruleVersion: string;
}

/**
 * A fixed calendar-month period with no employment start/end dates, so
 * proration always resolves to 1 (full period worked). This is a
 * standalone preview calculation — it isn't tied to any real employee,
 * company, or payroll run.
 */
function currentMonthPeriod() {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
  };
}

function assertValidAmounts(field: string, values?: Record<string, number>) {
  if (!values) return;
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`Invalid ${field} amount for "${key}"`);
    }
  }
}

@Injectable()
export class PayrollCalculatorService {
  constructor(private readonly rulesCache: RulesCacheService) {}

  listSupportedCountries(): SupportedCountry[] {
    return getSupportedCountries().map((countryCode) => {
      const ruleSet = getCountryRuleSet(countryCode);
      return {
        countryCode,
        currency: ruleSet.currency,
        ruleVersion: ruleSet.version,
      };
    });
  }

  async calculate(dto: CalculatePayrollDto): Promise<PayrollCalculationResult> {
    const countryCode = dto.country.toUpperCase();
    const supported = getSupportedCountries();
    if (!supported.includes(countryCode)) {
      throw new BadRequestException(
        `Unsupported country "${dto.country}". Supported countries: ${supported.join(', ')}`,
      );
    }
    assertValidAmounts('allowance', dto.allowances);
    assertValidAmounts('deduction', dto.deductions);

    const ruleSet = await this.rulesCache.resolve(countryCode, new Date());

    const input: PayrollCalculationInput = {
      employeeId: 'calculator-preview',
      countryCode,
      currency: ruleSet.currency,
      earnings: {
        basicSalary: dto.salary,
        allowances: dto.allowances,
      },
      ...(dto.deductions && Object.keys(dto.deductions).length > 0
        ? { deductions: { voluntary: dto.deductions } }
        : {}),
      period: currentMonthPeriod(),
    };

    return runPayrollCalculation(input, ruleSet);
  }
}
