export interface MonthlyCoach {
  id: string;
  name: string;
  status: string;
  manualMode: boolean;
  studentLimit: number;
  monthlyPricePyg: number | null;
  revision: number;
  activeStudents: number;
  month: string;
  paid: boolean;
  paymentRevision: number;
}
export interface MonthlyStudent {
  id: string;
  name: string;
  status: 'invited' | 'active' | 'paused' | 'archived';
  userId: string | null;
  version: number;
  paid: boolean;
  paymentRevision: number;
}
