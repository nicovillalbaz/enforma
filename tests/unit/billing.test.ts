import { describe, it, expect } from 'vitest';
import { monthlyAmount, validMonth } from '@forma/shared';
describe('T07 integer proration', () => {
  it('rounds half up per student for 28/29/30/31 days without floating point', () => {
    expect(monthlyAmount(15000, 15, 30)).toBe(7500);
    expect(monthlyAmount(1, 14, 28)).toBe(1);
    expect(monthlyAmount(10000, 1, 31)).toBe(323);
    expect(monthlyAmount(15000, 1, 29)).toBe(517);
    expect(monthlyAmount(10000, 0, 28)).toBe(0);
    for (const days of [28, 29, 30, 31]) expect(monthlyAmount(15000, days, days)).toBe(15000);
  });
  it('rejects fractional currency, bad day counts and invalid month input', () => {
    for (const args of [
      [1.5, 1, 30],
      [-1, 1, 30],
      [100, 32, 31],
      [100, 1, 27],
      [NaN, 1, 30],
    ])
      expect(() => monthlyAmount(args[0]!, args[1]!, args[2]!)).toThrow();
    for (const m of ['2026-00', '2026-13', '2026-2', '2026-02-01'])
      expect(validMonth(m)).toBe(false);
    expect(validMonth('2026-02')).toBe(true);
  });
});
