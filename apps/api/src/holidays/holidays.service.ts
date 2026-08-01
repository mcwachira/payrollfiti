import { Injectable } from '@nestjs/common';
import {
  getHolidayDefinitions,
  HolidayDefinition,
} from './holiday-definitions';

function isSameUtcDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

@Injectable()
export class HolidaysService {
  listForCountry(countryCode: string, year: number): HolidayDefinition[] {
    return getHolidayDefinitions(countryCode, year).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }

  isHoliday(countryCode: string, date: Date): boolean {
    const holidays = getHolidayDefinitions(countryCode, date.getUTCFullYear());
    return holidays.some((h) => isSameUtcDate(h.date, date));
  }

  /** Count of public holidays falling within [start, end], inclusive, spanning any number of years. */
  countHolidaysInRange(countryCode: string, start: Date, end: Date): number {
    let count = 0;
    for (
      let year = start.getUTCFullYear();
      year <= end.getUTCFullYear();
      year++
    ) {
      for (const holiday of getHolidayDefinitions(countryCode, year)) {
        if (holiday.date >= start && holiday.date <= end) count++;
      }
    }
    return count;
  }
}
