import { expect, it } from 'vitest';
import { scheduledDates, checkinErrors, habitProgress, type CheckinDocument } from '@forma/shared';
it('clamps monthly day 31 at February and preserves weekly ISO weekdays', () => {
  expect(scheduledDates('2026-02-01', '2026-03-31', 'monthly', 1, 31)).toEqual([
    '2026-02-28',
    '2026-03-31',
  ]);
  expect(scheduledDates('2026-10-19', '2026-10-25', 'weekly', 7, 1)).toEqual(['2026-10-25']);
});
it('keeps false and zero, rejects unknown fields and invalid scales', () => {
  const doc: CheckinDocument = {
    name: 'Semana',
    description: '',
    fields: [
      {
        id: 'a',
        label: 'Energía',
        type: 'scale',
        required: true,
        min: 0,
        max: 5,
        options: [],
        unit: '',
      },
      {
        id: 'b',
        label: 'Realizado',
        type: 'boolean',
        required: true,
        min: null,
        max: null,
        options: [],
        unit: '',
      },
    ],
  };
  expect(checkinErrors(doc, { a: 0, b: false })).toEqual([]);
  expect(checkinErrors(doc, { a: 1.5, b: false })).toHaveLength(1);
  expect(checkinErrors(doc, { a: 0, b: false, foreign: 1 })).toHaveLength(1);
  expect(checkinErrors(doc, {}, true)).toEqual([]);
});
it('does not count absent habits as zero or infer a target', () => {
  const habit = {
    id: 'h',
    document: {
      name: 'Agua',
      kind: 'water' as const,
      target: null,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      instructions: '',
    },
    startsOn: '2026-10-19',
    endsOn: '2026-10-25',
    cancelled: false,
    revision: 1,
  };
  expect(
    habitProgress(
      habit,
      [
        { habitId: 'h', day: '2026-10-19', value: 0, note: '', revision: 1 },
        { habitId: 'h', day: '2026-10-20', value: null, note: '', revision: 1 },
      ],
      '2026-10-19',
      '2026-10-21',
    ),
  ).toEqual({ expected: 3, recorded: 1, met: null });
});
