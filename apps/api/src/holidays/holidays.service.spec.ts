import { describe, it, expect, beforeEach } from '@jest/globals';
import { HolidaysService } from './holidays.service';

describe('HolidaysService', () => {
  let service: HolidaysService;

  beforeEach(() => {
    service = new HolidaysService();
  });

  describe('listForCountry', () => {
    it('returns Kenya holidays sorted by date, including Easter-relative ones', () => {
      const holidays = service.listForCountry('KE', 2026);
      const names = holidays.map((h) => h.name);
      expect(names).toContain("New Year's Day");
      expect(names).toContain('Jamhuri Day');
      expect(names).toContain('Good Friday');

      // Easter Sunday 2026 is April 5 -> Good Friday is April 3.
      const goodFriday = holidays.find((h) => h.name === 'Good Friday');
      expect(goodFriday?.date.toISOString().slice(0, 10)).toBe('2026-04-03');

      // Sorted ascending by date.
      const times = holidays.map((h) => h.date.getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));
    });

    it('returns Nigeria holidays without any Islamic-calendar entries', () => {
      const holidays = service.listForCountry('NG', 2026);
      const names = holidays.map((h) => h.name);
      expect(names).toContain('Democracy Day');
      expect(names).not.toContain('Eid al-Fitr');
      expect(names).not.toContain('Eid al-Adha');
    });

    it('returns South Africa holidays', () => {
      const holidays = service.listForCountry('ZA', 2026);
      expect(holidays.map((h) => h.name)).toContain('Heritage Day');
    });

    it('returns an empty list for an unsupported country', () => {
      expect(service.listForCountry('US', 2026)).toEqual([]);
    });
  });

  describe('isHoliday', () => {
    it('recognizes a fixed-date holiday', () => {
      expect(service.isHoliday('KE', new Date('2026-12-12'))).toBe(true);
    });

    it('recognizes an Easter-relative holiday', () => {
      expect(service.isHoliday('ZA', new Date('2026-04-03'))).toBe(true); // Good Friday
      expect(service.isHoliday('ZA', new Date('2026-04-06'))).toBe(true); // Family Day (Easter Monday)
    });

    it('returns false for a non-holiday date', () => {
      expect(service.isHoliday('KE', new Date('2026-07-15'))).toBe(false);
    });
  });

  describe('countHolidaysInRange', () => {
    it('counts holidays within an inclusive range', () => {
      const count = service.countHolidaysInRange(
        'KE',
        new Date('2026-12-11'),
        new Date('2026-12-13'),
      );
      expect(count).toBe(1); // Jamhuri Day, Dec 12
    });

    it('spans a range crossing a year boundary', () => {
      const count = service.countHolidaysInRange(
        'KE',
        new Date('2026-12-24'),
        new Date('2027-01-02'),
      );
      // Christmas Day + Boxing Day (2026) + New Year's Day (2027)
      expect(count).toBe(3);
    });

    it('returns 0 for a range with no holidays', () => {
      const count = service.countHolidaysInRange(
        'KE',
        new Date('2026-07-06'),
        new Date('2026-07-10'),
      );
      expect(count).toBe(0);
    });
  });
});
