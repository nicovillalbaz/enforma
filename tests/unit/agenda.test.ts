import { it, expect } from 'vitest';
import { zonedCandidates, zonedLocal, dateShift } from '@forma/shared';
it('rejects a nonexistent local hour and invalid dates instead of shifting the booking', () => {
  expect(zonedCandidates('2024-03-10T02:30', 'America/New_York')).toEqual([]);
  expect(zonedCandidates('2024-02-30T09:00', 'UTC')).toEqual([]);
});
it('returns both interpretations of a repeated hour for explicit choice', () => {
  expect(zonedCandidates('2024-11-03T01:30', 'America/New_York')).toEqual([
    '2024-11-03T05:30:00.000Z',
    '2024-11-03T06:30:00.000Z',
  ]);
});
it('keeps wall-clock formatting separate from the device zone and shifts leap dates safely', () => {
  expect(zonedLocal('2024-11-03T06:30:00Z', 'America/New_York')).toBe('2024-11-03T01:30');
  expect(zonedCandidates('2026-10-22T09:00', 'UTC')).toEqual(['2026-10-22T09:00:00.000Z']);
  expect(dateShift('2024-02-28', 1)).toBe('2024-02-29');
});
