import { describe, it, expect } from 'vitest';
import { adherence, percentageChange, validMeasurement } from '@forma/shared';
const body = {
  requestId: '10000000-0000-4000-8000-000000000001',
  kind: 'weight',
  value: 70.5,
  measuredOn: '2026-10-21',
};
describe('T06 units and missing data', () => {
  it('distinguishes no obligation or comparison baseline from real zero', () => {
    expect(adherence(0, 0)).toBeNull();
    expect(adherence(0, 4)).toBe(0);
    expect(adherence(2, 4)).toBe(50);
    expect(percentageChange(100, 0)).toBeNull();
    expect(percentageChange(0, 100)).toBe(-100);
    expect(percentageChange(150, 100)).toBe(50);
  });
  it('rejects coercion, non-finite values, invalid dates and wrong units', () => {
    expect(validMeasurement(body)).toBe(true);
    for (const value of [null, '70', NaN, Infinity, 0, -1, 501])
      expect(validMeasurement({ ...body, value })).toBe(false);
    expect(validMeasurement({ ...body, kind: 'waist', value: 301 })).toBe(false);
    for (const measuredOn of [
      '0000-01-01',
      '2026-02-30',
      '2026-13-01',
      'x',
      '2026-10-21T00:00:00Z',
    ])
      expect(validMeasurement({ ...body, measuredOn })).toBe(false);
    expect(validMeasurement({ ...body, measuredOn: '2024-02-29' })).toBe(true);
  });
});
