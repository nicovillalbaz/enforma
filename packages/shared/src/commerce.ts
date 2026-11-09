export type CoachCurrency = 'PYG' | 'USD' | 'EUR';
export const currencyDigits: Record<CoachCurrency, number> = { PYG: 0, USD: 2, EUR: 2 };
export const serviceKinds = {
  single: 'Servicio único',
  membership: 'Membresía',
  package: 'Paquete de sesiones',
};
export const prospectStages = {
  new: 'Nuevo',
  contacted: 'Contactado',
  trial: 'Prueba',
  won: 'Convertido',
  lost: 'Perdido',
  erased: 'Datos eliminados',
};
export function parseMinor(text: string, currency: CoachCurrency): number | null {
  const digits = currencyDigits[currency];
  const match = /^(\d{1,13})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match || (match[2]?.length ?? 0) > digits) return null;
  const value =
    BigInt(match[1]!) * 10n ** BigInt(digits) + BigInt((match[2] ?? '').padEnd(digits, '0') || '0');
  return value <= 1000000000000n ? Number(value) : null;
}
export function minorInput(value: number, currency: CoachCurrency) {
  return (value / 10 ** currencyDigits[currency]).toFixed(currencyDigits[currency]);
}
export function formatMinor(value: number | string, currency: CoachCurrency) {
  const n = BigInt(value),
    digits = currencyDigits[currency],
    scale = 10n ** BigInt(digits),
    abs = n < 0 ? -n : n;
  return `${currency} ${n < 0 ? '−' : ''}${new Intl.NumberFormat('es-PY').format(abs / scale)}${digits ? ',' + (abs % scale).toString().padStart(digits, '0') : ''}`;
}
export interface CoachService {
  id: string;
  name: string;
  description: string;
  kind: keyof typeof serviceKinds;
  currency: CoachCurrency;
  priceMinor: number;
  validityDays: number;
  sessions: number;
  capacity: number;
  archived: boolean;
  revision: number;
}
export interface CoachContract {
  id: string;
  studentId: string;
  studentName: string;
  serviceId: string;
  snapshot: CoachService;
  startsOn: string;
  endsOn: string;
  cancelled: boolean;
  cancellationReason: string;
  revision: number;
  renewalOf: string | null;
  state: 'scheduled' | 'active' | 'expired' | 'cancelled';
  totalMinor: number;
  balanceMinor: number;
  netPaidMinor: number;
  usedSessions: number;
  remainingSessions: number;
  nextDueOn: string | null;
}
export interface CoachPayment {
  id: string;
  amountMinor: number;
  paidOn: string;
  reference: string;
  method: string;
  returnedMinor: number;
  receiptUrl: string | null;
  corrected: boolean;
}
export interface CoachCharge {
  id: string;
  ordinal: number;
  dueOn: string;
  amountMinor: number;
  adjustedMinor: number;
  netPaidMinor: number;
  balanceMinor: number;
  payments: CoachPayment[];
  adjustments: { id: string; amountMinor: number; reason: string; createdAt: string }[];
}
export interface CoachSessionEntry {
  id: string;
  kind: 'use' | 'restore';
  bookingId: string | null;
  useId: string | null;
  reason: string;
  createdAt: string;
}
export interface CoachContractDetail {
  contract: CoachContract;
  charges: CoachCharge[];
  refunds: {
    id: string;
    paymentId: string;
    amountMinor: number;
    kind: string;
    reason: string;
    returnedOn: string;
  }[];
  sessions: CoachSessionEntry[];
  eligibleBookings: { id: string; title: string; startsAt: string }[];
}
export interface CoachProspect {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  stage: keyof typeof prospectStages;
  nextAction: string;
  nextOn: string | null;
  notes: string;
  revision: number;
  studentId: string | null;
  createdAt: string;
}
export interface CoachSummary {
  currency: CoachCurrency;
  salesMinor: string;
  grossMinor: string;
  refundsMinor: string;
  netMinor: string;
  dueMinor: string;
  overdueMinor: string;
  sales: number;
  cancellations: number;
  expirations: number;
}
export interface CoachHome {
  owner: boolean;
  timezone: string;
  today: string;
  services: CoachService[];
  contracts: CoachContract[];
  nextCursor: string | null;
  students: { id: string; name: string; status: string }[];
}
