import type { ProgramDay, PrescribedSet } from './index.js';
export interface WorkoutActual {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceMeters: number | null;
  rpe: number | null;
  note: string;
}
export interface WorkoutSet {
  entryId: string;
  setId: string;
  position: number;
  metric: 'reps' | 'time' | 'distance';
  target: PrescribedSet;
  state: 'pending' | 'recorded' | 'undone';
  revision: number;
  actual: WorkoutActual;
  recordedAt: string | null;
}
export interface WorkoutSession {
  id: string;
  organizationId: string;
  studentId: string;
  studentName: string;
  userId: string;
  assignmentId: string;
  versionId: string;
  weekId: string;
  dayId: string;
  scheduledOn: string;
  programName: string;
  versionNumber: number;
  weekName: string;
  prescription: ProgramDay;
  state: 'planned' | 'in_progress' | 'completed';
  revision: number;
  notes: string;
  notesRevision: number;
  startedClientAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  accessActive: boolean;
  sets: WorkoutSet[];
}
type Base = { expectedRevision: number; clientOccurredAt: string };
export type WorkoutCommand = Base &
  (
    | { kind: 'session.start' }
    | { kind: 'set.save'; entryId: string; setId: string; actual: WorkoutActual }
    | { kind: 'set.undo'; entryId: string; setId: string }
    | { kind: 'session.note'; notes: string }
    | { kind: 'session.complete'; notes: string; durationSeconds: number; allowPartial: boolean }
    | { kind: 'session.reopen'; reason: string }
  );
export interface WorkoutEvent {
  clientEventId: string;
  deviceId: string;
  command: WorkoutCommand;
}
export interface WorkoutReceipt {
  clientEventId: string;
  status: 'accepted' | 'rejected';
  code: string | null;
  sessionRevision: number;
}
export interface WorkoutResult {
  receipt: WorkoutReceipt;
  session: WorkoutSession;
}
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const integer = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
export function validWorkoutEvent(value: unknown): value is WorkoutEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as WorkoutEvent,
    c = e.command;
  if (
    !uuid.test(e.clientEventId) ||
    !uuid.test(e.deviceId) ||
    !c ||
    !integer(c.expectedRevision, 0, 1000000) ||
    typeof c.clientOccurredAt !== 'string' ||
    !Number.isFinite(Date.parse(c.clientOccurredAt)) ||
    Date.parse(c.clientOccurredAt) < Date.parse('2000-01-01') ||
    Date.parse(c.clientOccurredAt) > Date.parse('2100-01-01')
  )
    return false;
  if (c.kind === 'set.save' || c.kind === 'set.undo') {
    if (!uuid.test(c.entryId) || !uuid.test(c.setId)) return false;
  }
  if (c.kind === 'set.save') {
    const a = c.actual;
    if (!a || typeof a.note !== 'string' || a.note.length > 500) return false;
    for (const [k, min, max, int] of [
      ['weightKg', 0, 1000, false],
      ['reps', 1, 999, true],
      ['seconds', 1, 86400, true],
      ['distanceMeters', 1, 100000, false],
      ['rpe', 1, 10, false],
    ] as const) {
      const n = a[k];
      if (
        n !== null &&
        (typeof n !== 'number' ||
          !Number.isFinite(n) ||
          n < min ||
          n > max ||
          (int && !Number.isInteger(n)))
      )
        return false;
    }
  }
  if (
    (c.kind === 'session.note' || c.kind === 'session.complete') &&
    (typeof c.notes !== 'string' || c.notes.length > 1500)
  )
    return false;
  if (
    c.kind === 'session.complete' &&
    (!integer(c.durationSeconds, 0, 86400) || typeof c.allowPartial !== 'boolean')
  )
    return false;
  if (
    c.kind === 'session.reopen' &&
    (typeof c.reason !== 'string' || c.reason.trim().length < 3 || c.reason.length > 200)
  )
    return false;
  return (
    [
      'session.start',
      'set.save',
      'set.undo',
      'session.note',
      'session.complete',
      'session.reopen',
    ].includes(c.kind) && JSON.stringify(e).length <= 7500
  );
}
export function emptyActual(): WorkoutActual {
  return { weightKg: null, reps: null, seconds: null, distanceMeters: null, rpe: null, note: '' };
}
// The projection acknowledges only durable local intentions. Server receipts remain separate.
export function projectWorkout(base: WorkoutSession, events: WorkoutEvent[]): WorkoutSession {
  const s = JSON.parse(JSON.stringify(base)) as WorkoutSession;
  for (const { command: c } of events) {
    if (c.kind === 'session.start') {
      s.state = 'in_progress';
      s.startedClientAt = c.clientOccurredAt;
    }
    if (c.kind === 'session.reopen') {
      s.state = 'in_progress';
      s.completedAt = null;
      s.startedClientAt = c.clientOccurredAt;
    }
    if (c.kind === 'set.save' || c.kind === 'set.undo') {
      const r = s.sets.find((r) => r.entryId === c.entryId && r.setId === c.setId);
      if (r) {
        r.state = c.kind === 'set.save' ? 'recorded' : 'undone';
        r.actual = c.kind === 'set.save' ? JSON.parse(JSON.stringify(c.actual)) : emptyActual();
        r.revision++;
      }
    }
    if (c.kind === 'session.note' || c.kind === 'session.complete') {
      s.notes = c.notes;
      s.notesRevision++;
    }
    if (c.kind === 'session.complete') {
      s.state = 'completed';
      s.durationSeconds = c.durationSeconds;
      s.completedAt = c.clientOccurredAt;
    }
    s.revision++;
  }
  return s;
}
export function workoutDuration(s: WorkoutSession, now = Date.now()) {
  return Math.min(
    86400,
    Math.max(
      0,
      (s.durationSeconds ?? 0) +
        (s.state === 'in_progress' && s.startedClientAt
          ? Math.floor((now - Date.parse(s.startedClientAt)) / 1000)
          : 0),
    ),
  );
}
