import { it, expect } from 'vitest';
import { billingDate } from '../../apps/web/src/billing-date.js';
it('shows issued and adjustment dates in Paraguay across the UTC midnight boundary', () => {
  expect(billingDate('2026-10-21T02:30:00Z')).toBe('2026-10-20');
  expect(billingDate('2026-10-21T03:00:00Z')).toBe('2026-10-21');
});
