import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  validWorkoutEvent,
  projectWorkout,
  emptyActual,
  workoutDuration,
  type WorkoutSession,
  type WorkoutEvent,
} from '@forma/shared';
const event = (): WorkoutEvent => ({
  clientEventId: randomUUID(),
  deviceId: randomUUID(),
  command: {
    kind: 'set.save',
    entryId: randomUUID(),
    setId: randomUUID(),
    expectedRevision: 0,
    clientOccurredAt: new Date().toISOString(),
    actual: { ...emptyActual(), reps: 8 },
  },
});
describe('T05 durable workout intentions', () => {
  it('keeps zero load distinct from unspecified and rejects numeric strings, missing values and non-finite input', () => {
    const e = event();
    expect(validWorkoutEvent(e)).toBe(true);
    if (e.command.kind !== 'set.save') throw Error();
    e.command.actual.weightKg = 0;
    expect(validWorkoutEvent(e)).toBe(true);
    for (const value of ['', undefined, Infinity, -1, '30']) {
      e.command.actual.weightKg = value as number;
      expect(validWorkoutEvent(e)).toBe(false);
    }
  });
  it('rejects null CAS, invalid dates, negative or fractional reps and oversized notes', () => {
    const e = event();
    e.command.expectedRevision = null as unknown as number;
    expect(validWorkoutEvent(e)).toBe(false);
    e.command.expectedRevision = 0;
    e.command.clientOccurredAt = 'tomorrow';
    expect(validWorkoutEvent(e)).toBe(false);
    e.command.clientOccurredAt = new Date().toISOString();
    if (e.command.kind !== 'set.save') throw Error();
    e.command.actual.reps = 8.2;
    expect(validWorkoutEvent(e)).toBe(false);
    e.command.actual.reps = 8;
    e.command.actual.note = 'x'.repeat(501);
    expect(validWorkoutEvent(e)).toBe(false);
  });
  it('projects save and undo without mutating confirmed facts or prescription', () => {
    const e = event();
    if (e.command.kind !== 'set.save') throw Error();
    const session = {
      revision: 1,
      notesRevision: 0,
      sets: [
        {
          entryId: e.command.entryId,
          setId: e.command.setId,
          revision: 0,
          state: 'pending',
          actual: emptyActual(),
          target: { weightKg: 50 },
        },
      ],
    } as WorkoutSession;
    const local = projectWorkout(session, [e]);
    expect(local.sets[0]!.actual.reps).toBe(8);
    expect(session.sets[0]!.actual.reps).toBeNull();
    expect(local.sets[0]!.target.weightKg).toBe(50);
    const undone = projectWorkout(local, [{ ...e, command: { ...e.command, kind: 'set.undo' } }]);
    expect(undone.sets[0]!.state).toBe('undone');
    expect(undone.sets[0]!.actual.reps).toBeNull();
  });
  it('computes elapsed time from a persisted deadline segment after background time, without tick counting', () => {
    const s = {
      state: 'in_progress',
      durationSeconds: 120,
      startedClientAt: '2026-10-21T12:00:00Z',
    } as WorkoutSession;
    expect(workoutDuration(s, Date.parse('2026-10-21T12:04:00Z'))).toBe(360);
    expect(workoutDuration(s, Date.parse('2026-10-23T12:04:00Z'))).toBe(86400);
  });
});
