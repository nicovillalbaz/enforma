export const product = { name: 'Forma', version: '0.15.0', timezone: 'America/Asuncion' } as const;
export * from './coach-start.js';
export * from './monthly.js';
export * from './commerce.js';
export * from './workouts.js';
export * from './progress.js';
export interface ApiError {
  code: string;
  message: string;
  request_id: string;
}
export interface HealthResponse {
  status: 'ok';
  service: 'forma-api';
  version: string;
}
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  isSuperadmin: boolean;
  theme: 'light' | 'dark';
}
export type StudentState = 'invited' | 'active' | 'paused' | 'archived';
export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'coach' | 'student';
  status: 'trial' | 'active' | 'suspended';
  studentStatus: StudentState | null;
}
export interface Brand {
  id?: string;
  name: string;
  slug?: string;
  accent: string;
  logoUrl?: string | null;
  welcomeMessage?: string;
  biography?: string;
  contactEmail?: string | null;
  status?: string;
}
export interface StudentRecord {
  id: string;
  displayName: string;
  email: string;
  goal: string;
  status: StudentState;
  userId: string | null;
  version: number;
  createdAt: string;
}
export interface Subscription {
  plan: string;
  planCode: string;
  version: number;
  perStudentPricePyg: number;
  studentLimit: number;
  enabledStudents: number;
  totalStudents: number;
  status: string;
  trialEndsAt: string;
  features: Record<string, boolean>;
  manualMode?: boolean;
  monthlyPricePyg?: number | null;
}
export interface PublicInvitation {
  studentName: string;
  email: string;
  expiresAt: string;
  brand: Brand;
}

export interface MediaAsset {
  id: string;
  kind: 'image' | 'video';
  state:
    | 'reserved'
    | 'uploading'
    | 'pending'
    | 'processing'
    | 'ready'
    | 'failed'
    | 'cancelled'
    | 'deleted';
  bytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  version: number;
  errorCode: string | null;
  createdAt: string;
  url: string | null;
  posterUrl: string | null;
  processingMs: number | null;
}
export interface LibraryExercise {
  visualKey?: string | null;
  id: string;
  name: string;
  instructions: string;
  muscle: string;
  equipmentTag: string;
  metric: 'reps' | 'time' | 'distance';
  variations: string[];
  tags: string[];
  state: 'draft' | 'published' | 'archived';
  version: number;
  global: boolean;
  equipmentId: string | null;
  equipmentName: string | null;
  mediaId: string | null;
  media: MediaAsset | null;
  createdAt: string;
}
export interface StudioEquipment {
  id: string;
  name: string;
  description: string;
  location: string;
  state: 'available' | 'maintenance' | 'archived';
  photoId: string | null;
  photo: MediaAsset | null;
  version: number;
}
export interface MediaUsage {
  usedBytes: number;
  limitBytes: number;
  videoSeconds: number;
  limitSeconds: number;
  pending: number;
  workerOnline: boolean;
}

export { validateProgram, freshSet, cloneWeek, cloneDay, dateAt } from './programs.js';
export interface PrescribedSet {
  id: string;
  repsMin: number | null;
  repsMax: number | null;
  weightKg: number | null;
  seconds: number | null;
  distanceMeters: number | null;
  restSeconds: number;
  rpe: number | null;
}
export interface ExerciseSnapshot {
  visualKey?: string | null;
  name: string;
  instructions: string;
  muscle: string;
  metric: 'reps' | 'time' | 'distance';
  equipmentTag: string;
  variations: string[];
  tags: string[];
  mediaId: string | null;
  photoId: string | null;
  equipment: { name: string; description: string; location: string; state: string } | null;
  media?: MediaAsset | null;
  photo?: MediaAsset | null;
}
export interface ProgramEntry {
  id: string;
  exerciseId: string;
  notes: string;
  sets: PrescribedSet[];
  snapshot?: ExerciseSnapshot;
}
export interface ProgramDay {
  id: string;
  name: string;
  weekday: number;
  notes: string;
  exercises: ProgramEntry[];
}
export interface ProgramWeek {
  id: string;
  name: string;
  days: ProgramDay[];
}
export interface ProgramDocument {
  name: string;
  description: string;
  isTemplate: boolean;
  weeks: ProgramWeek[];
}
export interface TrainingProgram {
  id: string;
  document: ProgramDocument;
  revision: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  publishedCount: number;
  latestPublishedRevision: number | null;
}
export interface ProgramVersion {
  id: string;
  programId: string;
  number: number;
  sourceRevision: number;
  snapshot: ProgramDocument;
  createdAt: string;
}
export interface ProgramAssignment {
  id: string;
  versionId: string;
  studentId: string;
  studentName: string;
  programName: string;
  versionNumber: number;
  startsOn: string;
  endsOn: string;
  state: 'active' | 'cancelled';
  revision: number;
  cancellationReason: string | null;
}

export * from './billing.js';
export * from './resources.js';
export * from './nutrition.js';
export * from './followup.js';
export * from './agenda.js';
export * from './anthropometry.js';
