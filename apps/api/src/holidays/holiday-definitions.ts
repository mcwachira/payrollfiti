export interface HolidayDefinition {
  name: string;
  /** UTC midnight of the holiday date, for the requested year */
  date: Date;
}

function fixedDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Anonymous Gregorian algorithm (Meeus/Jones/Butcher) for the date of
 * Easter Sunday in a given year. Deterministic, no external data needed.
 */
function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return fixedDate(year, month, day);
}

/**
 * Fixed-date and Easter-relative public holidays for KE/NG/ZA.
 *
 * Explicit limitation: Islamic-calendar holidays (e.g. Nigeria's Eid
 * al-Fitr and Eid al-Adha) are excluded — their Gregorian dates depend on
 * lunar sighting and aren't reliably computable without an external
 * lunar-calendar data source, so including guessed dates would be worse
 * than omitting them. Mirrors the SmsProvider/PushProvider "don't fake it"
 * documentation pattern used elsewhere in this codebase.
 */
export function getHolidayDefinitions(
  countryCode: string,
  year: number,
): HolidayDefinition[] {
  const easterSunday = computeEasterSunday(year);
  const goodFriday = addDays(easterSunday, -2);
  const easterMonday = addDays(easterSunday, 1);

  switch (countryCode.toUpperCase()) {
    case 'KE':
      return [
        { name: "New Year's Day", date: fixedDate(year, 1, 1) },
        { name: 'Good Friday', date: goodFriday },
        { name: 'Easter Monday', date: easterMonday },
        { name: 'Labour Day', date: fixedDate(year, 5, 1) },
        { name: 'Madaraka Day', date: fixedDate(year, 6, 1) },
        { name: 'Huduma Day', date: fixedDate(year, 10, 10) },
        { name: 'Mashujaa Day', date: fixedDate(year, 10, 20) },
        { name: 'Jamhuri Day', date: fixedDate(year, 12, 12) },
        { name: 'Christmas Day', date: fixedDate(year, 12, 25) },
        { name: 'Boxing Day', date: fixedDate(year, 12, 26) },
      ];
    case 'NG':
      return [
        { name: "New Year's Day", date: fixedDate(year, 1, 1) },
        { name: 'Good Friday', date: goodFriday },
        { name: 'Easter Monday', date: easterMonday },
        { name: "Workers' Day", date: fixedDate(year, 5, 1) },
        { name: 'Democracy Day', date: fixedDate(year, 6, 12) },
        { name: 'Independence Day', date: fixedDate(year, 10, 1) },
        { name: 'Christmas Day', date: fixedDate(year, 12, 25) },
        { name: 'Boxing Day', date: fixedDate(year, 12, 26) },
      ];
    case 'ZA':
      return [
        { name: "New Year's Day", date: fixedDate(year, 1, 1) },
        { name: 'Human Rights Day', date: fixedDate(year, 3, 21) },
        { name: 'Good Friday', date: goodFriday },
        { name: 'Family Day', date: easterMonday },
        { name: 'Freedom Day', date: fixedDate(year, 4, 27) },
        { name: "Workers' Day", date: fixedDate(year, 5, 1) },
        { name: 'Youth Day', date: fixedDate(year, 6, 16) },
        { name: "National Women's Day", date: fixedDate(year, 8, 9) },
        { name: 'Heritage Day', date: fixedDate(year, 9, 24) },
        { name: 'Day of Reconciliation', date: fixedDate(year, 12, 16) },
        { name: 'Christmas Day', date: fixedDate(year, 12, 25) },
        { name: 'Day of Goodwill', date: fixedDate(year, 12, 26) },
      ];
    default:
      return [];
  }
}
