import { expect, it } from 'vitest';
import { brandForeground, brandInk, contrastRatio } from '../../packages/ui/src/branding.js';
it('keeps bright and dark coach colors legible in both themes', () => {
  for (const color of [
    '#005ea8',
    '#19e7d0',
    '#7055bc',
    '#1d7655',
    '#a94a38',
    '#071022',
    '#777777',
    '#ffffff',
  ]) {
    expect(contrastRatio(color, brandForeground(color))).toBeGreaterThanOrEqual(4.5);
    for (const theme of ['light', 'dark'] as const) {
      expect(
        contrastRatio(brandInk(color, theme), theme === 'dark' ? '#16243f' : '#eaf5ff'),
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});
