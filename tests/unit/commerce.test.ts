import { it, expect } from 'vitest';
import { parseMinor, formatMinor } from '@forma/shared';
it('parses money exactly and rejects ambiguous grouping, extra precision and unsafe amounts', () => {
  expect(parseMinor('10000', 'PYG')).toBe(10000);
  expect(parseMinor('12,34', 'USD')).toBe(1234);
  expect(parseMinor('12.3', 'EUR')).toBe(1230);
  for (const text of ['1.000', '1,00', '1e3', '-1', 'NaN', '1000000000001'])
    expect(parseMinor(text, 'PYG')).toBeNull();
  expect(parseMinor('0.001', 'USD')).toBeNull();
});
it('formats aggregated minor units beyond JavaScript safe integer range without losing units or mixing currency', () => {
  expect(formatMinor('10000000000000001', 'USD')).toBe('USD 100.000.000.000.000,01');
  expect(formatMinor('-1234', 'EUR')).toBe('EUR −12,34');
  expect(formatMinor('10000', 'PYG')).toBe('PYG 10.000');
});
