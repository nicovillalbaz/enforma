export type HabitKind = 'check' | 'water' | 'sleep' | 'energy';
export const habitUnits = { check: 'hecho', water: 'L', sleep: 'h', energy: 'sobre 5' } as const;
export interface HabitDocument {
  name: string;
  kind: HabitKind;
  target: number | null;
  weekdays: number[];
  instructions: string;
}
export interface CheckinField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'scale' | 'choice' | 'boolean' | 'attachment';
  required: boolean;
  min: number | null;
  max: number | null;
  options: string[];
  unit: string;
}
export interface CheckinDocument {
  name: string;
  description: string;
  fields: CheckinField[];
}
export interface FollowupThread {
  id: string;
  studentId: string;
  studentName: string;
  professionalId: string;
  professionalName: string;
  lastSeq: number;
  readSeq: number;
  peerReadSeq: number;
  unread: number;
  canWrite: boolean;
  lastAt: string;
}
export interface FollowupSettings {
  revision: number;
  muted: boolean;
  trackingConsent: boolean;
}
export interface FollowupAttachment {
  id: string;
  name: string;
  kind: 'image' | 'video' | 'audio' | 'pdf' | 'resource';
  state: string;
  errorCode: string | null;
  mimeType: string | null;
  bytes: number;
  url: string | null;
  posterUrl: string | null;
}
export interface ChatMessage {
  id: string;
  seq: number;
  senderId: string;
  body: string;
  createdAt: string;
  withdrawn: boolean;
  attachments: FollowupAttachment[];
}
export interface FollowupNotification {
  id: string;
  threadId: string;
  kind: 'message' | 'checkin' | 'comment';
  createdAt: string;
  read: boolean;
}
export interface FollowupPreferences {
  revision: number;
  message: boolean;
  checkin: boolean;
  comment: boolean;
}
export interface FollowupHome {
  threads: FollowupThread[];
  nextCursor: string | null;
  contacts: {
    studentId: string;
    studentName: string;
    professionalId: string;
    professionalName: string;
  }[];
  notifications: FollowupNotification[];
  nextNotificationCursor: string | null;
  preferences: FollowupPreferences;
  workerOnline: boolean;
  pdfUploadsEnabled: boolean;
}
export interface HabitAssignment {
  id: string;
  document: HabitDocument;
  startsOn: string;
  endsOn: string;
  cancelled: boolean;
  revision: number;
}
export interface HabitEntry {
  habitId: string;
  day: string;
  value: number | null;
  note: string;
  revision: number;
}
export interface CheckinTemplate {
  id: string;
  document: CheckinDocument;
  revision: number;
}
export interface CheckinResponse {
  id: string;
  revision: number;
  answers: Record<string, string | number | boolean | null>;
  declined: boolean;
  submittedAt: string;
  review: string | null;
  reviewedAt: string | null;
}
export interface CheckinTask {
  id: string;
  scheduleId: string;
  scheduledOn: string;
  closesOn: string;
  cancelled: boolean;
  document: CheckinDocument;
  response: CheckinResponse | null;
  attachments: FollowupAttachment[];
}
export interface FollowupTracking {
  trackingAllowed: boolean;
  recordingAllowed: boolean;
  habits: HabitAssignment[];
  entries: HabitEntry[];
  templates: CheckinTemplate[];
  tasks: CheckinTask[];
  schedules: {
    id: string;
    name: string;
    frequency: string;
    revision: number;
    cancelled: boolean;
  }[];
  truncated: boolean;
}
export function checkinErrors(
  doc: CheckinDocument,
  answers: Record<string, unknown>,
  declined = false,
): string[] {
  if (declined) return [];
  const errors: string[] = [];
  if (Object.keys(answers).some((id) => !doc.fields.some((f) => f.id === id)))
    errors.push('Hay respuestas de otro formulario.');
  for (const f of doc.fields) {
    const v = answers[f.id];
    if (v === null || v === undefined || v === '') {
      if (f.required) errors.push(f.label + ': falta una respuesta.');
      continue;
    }
    const invalid =
      f.type === 'text'
        ? typeof v !== 'string' || v.length > 2000
        : f.type === 'boolean'
          ? typeof v !== 'boolean'
          : f.type === 'choice'
            ? typeof v !== 'string' || !f.options.includes(v)
            : f.type === 'attachment'
              ? typeof v !== 'string' || !/^[a-f0-9-]{36}$/i.test(v)
              : typeof v !== 'number' ||
                !Number.isFinite(v) ||
                (f.min !== null && v < f.min) ||
                (f.max !== null && v > f.max) ||
                (f.type === 'scale' && !Number.isInteger(v));
    if (invalid) errors.push(f.label + ': revisa valor y unidad.');
  }
  return errors;
}
export function scheduledDates(
  from: string,
  to: string,
  frequency: 'weekly' | 'monthly',
  weekday: number,
  monthDay: number,
) {
  const result: string[] = [];
  for (
    let ms = Date.parse(from + 'T12:00:00Z');
    ms <= Date.parse(to + 'T12:00:00Z');
    ms += 86400000
  ) {
    const d = new Date(ms);
    if (
      frequency === 'weekly'
        ? (d.getUTCDay() || 7) === weekday
        : d.getUTCDate() ===
          Math.min(
            monthDay,
            new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(),
          )
    )
      result.push(d.toISOString().slice(0, 10));
  }
  return result;
}
export function habitProgress(
  assignment: HabitAssignment,
  entries: HabitEntry[],
  from: string,
  to: string,
) {
  let expected = 0,
    recorded = 0,
    met = 0;
  for (
    let ms = Date.parse(from + 'T12:00:00Z');
    ms <= Date.parse(to + 'T12:00:00Z');
    ms += 86400000
  ) {
    const day = new Date(ms).toISOString().slice(0, 10),
      weekday = new Date(ms).getUTCDay() || 7;
    if (
      day < assignment.startsOn ||
      day > assignment.endsOn ||
      !assignment.document.weekdays.includes(weekday)
    )
      continue;
    expected++;
    const entry = entries.find((e) => e.habitId === assignment.id && e.day === day);
    if (entry?.value !== null && entry?.value !== undefined) {
      recorded++;
      if (assignment.document.target !== null && entry.value >= assignment.document.target) met++;
    }
  }
  return { expected, recorded, met: assignment.document.target === null ? null : met };
}
