export interface BillingLine {
  studentId: string;
  name: string;
  days: number;
  dates: string[];
  pricePyg: number;
  amountPyg: number;
}
export interface BillingPreview {
  organizationName: string;
  month: string;
  currency: 'PYG';
  timezone: string;
  formula: string;
  daysInMonth: number;
  enrolledAt: string | null;
  chargeStartsAt: string | null;
  computedThrough: string;
  plan: {
    id: string;
    name: string;
    code: string;
    version: number;
    pricePyg: number;
    basePyg: number;
    includedStudents: number;
    minimumPyg: number;
    maximumPyg: null;
  };
  lines: BillingLine[];
  totalPyg: number;
  issuedId: string | null;
  isEstimate: boolean;
}
export interface BillingInvoice {
  id: string;
  month: string;
  issuedAt: string;
  totalPyg: number;
  adjustmentPyg: number;
  paidPyg: number;
  balancePyg: number;
  status: 'issued' | 'partial' | 'settled';
  snapshot: BillingPreview;
  adjustments: { id: string; amountPyg: number; reason: string; createdAt: string }[];
  payments: {
    id: string;
    amountPyg: number;
    reference: string;
    paidOn: string;
    createdAt: string;
    receiptUrl: string | null;
    reversal: { reason: string; createdAt: string } | null;
  }[];
}
export function monthlyAmount(price: number, days: number, daysInMonth: number) {
  if (
    !Number.isSafeInteger(price) ||
    price < 0 ||
    price > 1e12 ||
    !Number.isInteger(days) ||
    days < 0 ||
    !Number.isInteger(daysInMonth) ||
    daysInMonth < 28 ||
    daysInMonth > 31 ||
    days > daysInMonth
  )
    throw new Error('Invalid billing input');
  return Number(
    (BigInt(price) * BigInt(days) * 2n + BigInt(daysInMonth)) / (2n * BigInt(daysInMonth)),
  );
}
export const validMonth = (s: string) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(s);
