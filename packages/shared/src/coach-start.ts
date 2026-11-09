export interface CoachStartOverview {
  timezone: string;
  today: string;
  brandReady: boolean;
  emailVerified: boolean;
  activeStudents: number;
  invitedStudents: number;
  publishedPrograms: number;
  currentAssignments: number;
  upcomingSessions: number;
}
export const creator = {
  name: 'NAVZ',
  phone: '+595972995557',
  signature: 'Creado por NAVZ, +595972995557',
} as const;
