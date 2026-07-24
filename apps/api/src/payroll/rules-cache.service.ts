import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  CountryRuleSet,
  getCountryRuleSet,
  getRuleSetByVersion,
} from '@repo/payroll-rules';

const TTL_MS = 60 * 60 * 1000; // 1 hour — country tax rules change on the order of months, not minutes

function cacheKey(countryCode: string, effectiveDate: Date): string {
  return `payroll-rules:version:${countryCode.toUpperCase()}:${effectiveDate.toISOString().slice(0, 10)}`;
}

/**
 * The resolved CountryRuleSet carries functions, so it can't be stored in
 * Redis directly. Instead we cache which ruleset *version* applies for a
 * given (country, date) — the actual functions are looked up in-process
 * from the in-memory registry, which is effectively free once we know the
 * version. This avoids repeating the version-resolution scan/sort on every
 * request across all API instances.
 */
@Injectable()
export class RulesCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async resolve(
    countryCode: string,
    effectiveDate: Date,
  ): Promise<CountryRuleSet> {
    const key = cacheKey(countryCode, effectiveDate);
    const cachedVersion = await this.cache.get<string>(key);
    if (cachedVersion) {
      return getRuleSetByVersion(countryCode, cachedVersion);
    }

    const ruleSet = getCountryRuleSet(countryCode, effectiveDate);
    await this.cache.set(key, ruleSet.version, TTL_MS);
    return ruleSet;
  }
}
