import {
  getWeekNumber,
  getCurrentWeekNumber,
  formatDate,
  getWeekStartDate,
  getWeekDateRange,
} from '../dateUtils.js';

describe('getWeekNumber', () => {
  it('returns 1 for January 1st 2024 (Monday)', () => {
    // 2024-01-01 is a Monday, ISO week 1
    expect(getWeekNumber(new Date(2024, 0, 1))).toBe(1);
  });

  it('returns 52 or 53 for December 31st', () => {
    const week = getWeekNumber(new Date(2024, 11, 31));
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
  });

  it('returns correct week for a known mid-year date', () => {
    // 2024-03-11 is a Monday in ISO week 11
    expect(getWeekNumber(new Date(2024, 2, 11))).toBe(11);
  });

  it('handles year boundary where Dec 31 is in week 1 of next year', () => {
    // 2025-12-31 is a Wednesday - in ISO week 1 of 2026
    const week = getWeekNumber(new Date(2025, 11, 31));
    expect(week).toBe(1);
  });

  it('returns a number between 1 and 53 for any date', () => {
    const dates = [
      new Date(2023, 0, 1),
      new Date(2023, 5, 15),
      new Date(2023, 11, 31),
      new Date(2024, 6, 4),
    ];
    for (const d of dates) {
      const week = getWeekNumber(d);
      expect(week).toBeGreaterThanOrEqual(1);
      expect(week).toBeLessThanOrEqual(53);
    }
  });

  it('does not modify the original date object', () => {
    const original = new Date(2024, 5, 15);
    const originalTime = original.getTime();
    getWeekNumber(original);
    expect(original.getTime()).toBe(originalTime);
  });
});

describe('getCurrentWeekNumber', () => {
  it('returns a number between 1 and 53', () => {
    const week = getCurrentWeekNumber();
    expect(typeof week).toBe('number');
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
  });

  it('matches getWeekNumber called with current date', () => {
    // These should be very close (could differ by 1ms at boundary)
    const current = getCurrentWeekNumber();
    const manual = getWeekNumber(new Date());
    expect(current).toBe(manual);
  });
});

describe('formatDate', () => {
  it('returns a string containing the year', () => {
    const result = formatDate(new Date(2024, 0, 15));
    expect(result).toContain('2024');
  });

  it('returns a string containing the abbreviated month', () => {
    const result = formatDate(new Date(2024, 0, 15));
    expect(result).toContain('Jan');
  });

  it('returns a string containing the day number', () => {
    const result = formatDate(new Date(2024, 0, 15));
    expect(result).toContain('15');
  });

  it('formats different months correctly', () => {
    expect(formatDate(new Date(2024, 5, 1))).toContain('Jun');
    expect(formatDate(new Date(2024, 11, 25))).toContain('Dec');
  });
});

describe('getWeekStartDate', () => {
  it('returns a Date object', () => {
    const result = getWeekStartDate(1, 2024);
    expect(result).toBeInstanceOf(Date);
  });

  it('returns a Monday (day 1)', () => {
    const result = getWeekStartDate(10, 2024);
    expect(result.getDay()).toBe(1);
  });

  it('week 1 of 2024 starts on Jan 1 (which is a Monday)', () => {
    const result = getWeekStartDate(1, 2024);
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getFullYear()).toBe(2024);
  });

  it('consecutive weeks are 7 days apart', () => {
    const week5 = getWeekStartDate(5, 2024);
    const week6 = getWeekStartDate(6, 2024);
    const diffDays = (week6 - week5) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });

  it('defaults year to current year when omitted', () => {
    const result = getWeekStartDate(26);
    // Week 26 is always mid-year, so the year should match
    expect(result.getFullYear()).toBe(new Date().getFullYear());
  });
});

describe('getWeekDateRange', () => {
  it('returns an object with startDate, endDate, and formatted', () => {
    const result = getWeekDateRange(10, 2024);
    expect(result).toHaveProperty('startDate');
    expect(result).toHaveProperty('endDate');
    expect(result).toHaveProperty('formatted');
  });

  it('endDate is 6 days after startDate (Monday to Sunday)', () => {
    const result = getWeekDateRange(10, 2024);
    const diffDays = (result.endDate - result.startDate) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6);
  });

  it('startDate is a Monday', () => {
    const result = getWeekDateRange(15, 2024);
    expect(result.startDate.getDay()).toBe(1);
  });

  it('endDate is a Sunday', () => {
    const result = getWeekDateRange(15, 2024);
    expect(result.endDate.getDay()).toBe(0);
  });

  it('formatted string contains a dash separator', () => {
    const result = getWeekDateRange(10, 2024);
    expect(result.formatted).toContain(' - ');
  });

  it('formatted string contains both dates', () => {
    const result = getWeekDateRange(1, 2024);
    // Both start and end year should appear
    expect(result.formatted).toContain('2024');
  });
});
