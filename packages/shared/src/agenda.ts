export type AgendaRuleKind = 'welcome' | 'appointment.soon' | 'checkin.pending';
export const agendaRuleLabels: Record<AgendaRuleKind, string> = {
  welcome: 'Bienvenida al activar al alumno',
  'appointment.soon': 'Próxima cita o clase',
  'checkin.pending': 'Check-in pendiente',
};
export interface AgendaAvailability {
  id: string;
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  location: string;
  revision: number;
  cancelled: boolean;
}
export interface AgendaBooking {
  id: string;
  studentId: string;
  studentName: string;
  status: 'confirmed' | 'cancelled';
  attendance: 'pending' | 'attended' | 'absent';
  revision: number;
  cancelUntil: string;
  late: boolean;
}
export interface AgendaEvent {
  id: string;
  professionalId: string;
  professionalName: string;
  availabilityId: string;
  kind: 'appointment' | 'class';
  title: string;
  instructions: string;
  location: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  confirmed: number;
  published: boolean;
  revision: number;
  bookingLeadMinutes: number;
  cancelLeadMinutes: number;
  cancelled: boolean;
  canManage: boolean;
  canBook: boolean;
  ownBooking: AgendaBooking | null;
}
export interface AgendaPreferences {
  revision: number;
  booking: boolean;
  change: boolean;
  reminder: boolean;
  welcome: boolean;
  checkin: boolean;
  quietStart: number;
  quietEnd: number;
  dailyLimit: number;
}
export interface AgendaNotice {
  id: string;
  category: 'booking' | 'change' | 'reminder' | 'welcome' | 'checkin';
  createdAt: string;
  read: boolean;
  eventId: string | null;
  threadId: string | null;
}
export interface AgendaHome {
  timezone: string;
  today: string;
  studentId: string | null;
  events: AgendaEvent[];
  nextCursor: string | null;
  availability: AgendaAvailability[];
  professionals: { id: string; name: string }[];
  notifications: AgendaNotice[];
  preferences: AgendaPreferences;
  workerOnline: boolean;
  availabilityTruncated: boolean;
}
export interface AgendaRule {
  id: string;
  kind: AgendaRuleKind;
  enabled: boolean;
  leadMinutes: number;
  revision: number;
  version: number;
}
export interface AgendaRun {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  createdAt: string;
  revision: number;
  recipient: string;
  expiresAt: string;
  retries: number;
}
const wallFormats = new Map<string, Intl.DateTimeFormat>();
export function zonedLocal(instant: string, timezone: string) {
  let format = wallFormats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    wallFormats.set(timezone, format);
    if (wallFormats.size > 8) wallFormats.delete(wallFormats.keys().next().value!);
  }
  const parts = format.formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
// A wall-clock value may have zero, one or two UTC interpretations at DST changes.
export function zonedCandidates(local: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return [];
  if (local < '2000-01-01T00:00' || local > '2100-12-31T23:59') return [];
  const nominal = Date.parse(local + ':00Z');
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 16) !== local)
    return [];
  const offsets = new Set<number>();
  for (let h = -36; h <= 36; h += 6) {
    const stamp = nominal + h * 3600000;
    offsets.add(Date.parse(zonedLocal(new Date(stamp).toISOString(), timezone) + ':00Z') - stamp);
  }
  return [...offsets]
    .map((offset) => new Date(nominal - offset).toISOString())
    .filter((instant) => zonedLocal(instant, timezone) === local)
    .sort();
}
export function agendaDate(instant: string, timezone: string) {
  return zonedLocal(instant, timezone).slice(0, 10);
}
export function dateShift(day: string, amount: number) {
  return new Date(Date.parse(day + 'T12:00:00Z') + amount * 86400000).toISOString().slice(0, 10);
}
export function agendaTime(instant: string, timezone: string) {
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(instant));
}
