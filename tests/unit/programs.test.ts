import { it, expect } from 'vitest';
import { cloneWeek, dateAt, freshSet, validateProgram, type ProgramDocument } from '@forma/shared';
function plan(): ProgramDocument {
  return {
    name: 'Plan original',
    description: '',
    isTemplate: true,
    weeks: [
      {
        id: crypto.randomUUID(),
        name: 'Semana 1',
        days: [
          {
            id: crypto.randomUUID(),
            name: 'Fuerza',
            weekday: 1,
            notes: '',
            exercises: [
              {
                id: crypto.randomUUID(),
                exerciseId: crypto.randomUUID(),
                notes: '',
                sets: [freshSet()],
              },
            ],
          },
        ],
      },
    ],
  };
}
it('clones a week without sharing mutable prescriptions or any block identity', () => {
  const original = plan(),
    copy = cloneWeek(original.weeks[0]!);
  copy.days[0]!.exercises[0]!.sets[0]!.weightKg = 80;
  expect(original.weeks[0]!.days[0]!.exercises[0]!.sets[0]!.weightKg).toBeNull();
  expect(copy.days[0]!.exercises[0]!.sets[0]!.id).not.toBe(
    original.weeks[0]!.days[0]!.exercises[0]!.sets[0]!.id,
  );
  original.weeks.push(copy);
  expect(validateProgram(original, true)).toEqual([]);
});
it('keeps date-only schedules stable over month, year and leap-day boundaries', () => {
  expect(dateAt('2028-02-28', 1)).toBe('2028-02-29');
  expect(dateAt('2026-12-31', 1)).toBe('2027-01-01');
  expect(dateAt('2026-10-21', 55)).toBe('2026-12-15');
});
it('allows an unfinished draft while requiring populated weeks for publication', () => {
  const p = plan();
  p.weeks[0]!.days = [];
  expect(validateProgram(p)).toEqual([]);
  expect(validateProgram(p, true)).not.toEqual([]);
});
it('rejects duplicate cycle days and unsafe or inverted prescriptions', () => {
  const p = plan();
  const copy = cloneWeek(p.weeks[0]!);
  p.weeks[0]!.days.push(copy.days[0]!);
  expect(validateProgram(p)).not.toEqual([]);
  p.weeks[0]!.days.pop();
  const set = p.weeks[0]!.days[0]!.exercises[0]!.sets[0]!;
  set.repsMin = 20;
  set.repsMax = 10;
  set.restSeconds = Infinity;
  expect(validateProgram(p)).not.toEqual([]);
});
