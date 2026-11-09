export const measurementKinds = {
  weight: { label: 'Peso', unit: 'kg', max: 500 },
  height: { label: 'Altura', unit: 'cm', max: 300 },
  waist: { label: 'Cintura', unit: 'cm', max: 300 },
  hip: { label: 'Cadera', unit: 'cm', max: 300 },
  chest: { label: 'Pecho', unit: 'cm', max: 300 },
  arm: { label: 'Brazo', unit: 'cm', max: 300 },
  thigh: { label: 'Muslo', unit: 'cm', max: 300 },
} as const;
export type MeasurementKind = keyof typeof measurementKinds;
export interface BodyMeasurement {
  id: string;
  kind: MeasurementKind;
  value: number;
  unit: 'kg' | 'cm';
  measuredOn: string;
  source: 'self' | 'coach';
  createdBy: string;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  correctionOf: string | null;
}
export interface ProgressPhoto {
  id: string;
  measuredOn: string;
  caption: string;
  width: number;
  height: number;
  url: string;
  thumbnailUrl: string;
  createdAt: string;
}
export interface ProgressPrivacy {
  revision: number;
  photoConsent: boolean;
  consentVersion: string | null;
  professionals: {
    id: string;
    name: string;
    role: string;
    measurements: boolean;
    photos: boolean;
  }[];
}
export interface ProgressActivity {
  lastCompletedAt: string | null;
  daysInactive: number;
  enabled: boolean;
  thresholdDays: number;
  revision: number;
  flagged: boolean;
}
export interface ProgressExercise {
  exerciseId: string;
  metric: 'reps' | 'time' | 'distance';
  name: string;
  recordedSets: number;
  volumeKgReps: number;
  unweightedSets: number;
  bestLoadKg: number | null;
  bestLoadReps: number | null;
  bestSeconds: number | null;
  bestDistanceMeters: number | null;
}
export interface ProgressMetrics {
  studentId: string;
  studentName: string;
  from: string;
  to: string;
  timezone: string;
  dateBasis: 'scheduled_on';
  summary: {
    sessions: number;
    partialSessions: number;
    inProgress: number;
    recordedSets: number;
    volumeKgReps: number;
    unweightedSets: number;
    expectedDays: number;
    completedDays: number;
    missedDays: number;
    todayPending: number;
    cancelledDays: number;
    lastCompletedAt: string | null;
  };
  comparison: { last7Volume: number; previous7Volume: number };
  weekly: {
    week: string;
    volumeKgReps: number;
    recordedSets: number;
    unweightedSets: number;
    expectedDays: number;
    completedDays: number;
  }[];
  exercises: ProgressExercise[];
  trend: {
    exerciseId: string;
    metric: ProgressExercise['metric'];
    date: string;
    volumeKgReps: number;
    bestLoadKg: number | null;
    bestSeconds: number | null;
    bestDistanceMeters: number | null;
    recordedSets: number;
  }[];
  access: { measurements: boolean; photos: boolean };
  activity: ProgressActivity;
}
export interface ProgressRosterStudent {
  id: string;
  name: string;
  status: string;
  sessions: number;
  volumeKgReps: number;
  activity: ProgressActivity;
}
export function adherence(completed: number, expected: number) {
  return expected > 0 ? Math.round((completed / expected) * 100) : null;
}
export function percentageChange(current: number, previous: number) {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}
export function validMeasurement(
  value: unknown,
): value is { kind: MeasurementKind; value: number; measuredOn: string; requestId: string } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.kind === 'string' &&
    Object.hasOwn(measurementKinds, v.kind) &&
    typeof v.value === 'number' &&
    Number.isFinite(v.value) &&
    v.value > 0 &&
    v.value <= measurementKinds[v.kind as MeasurementKind].max &&
    typeof v.measuredOn === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.measuredOn) &&
    v.measuredOn >= '2000-01-01' &&
    v.measuredOn <= '2100-01-01' &&
    Number.isFinite(Date.parse(v.measuredOn + 'T12:00:00Z')) &&
    new Date(v.measuredOn + 'T12:00:00Z').toISOString().slice(0, 10) === v.measuredOn &&
    typeof v.requestId === 'string' &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(v.requestId)
  );
}
