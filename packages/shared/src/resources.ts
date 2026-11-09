export type ResourceKind = 'media' | 'upload' | 'routine' | 'history' | 'report' | 'menu';
export interface ResourceCollection {
  id: string;
  name: string;
  description: string;
  studentId: string | null;
  programVersionId: string | null;
  revision: number;
  canManage: boolean;
}
export interface ResourceVersion {
  id: string;
  number: number;
  kind: ResourceKind;
  state: string;
  bytes: number;
  templateVersion: string | null;
  errorCode: string | null;
  createdAt: string;
}
export interface PrivateResource {
  id: string;
  name: string;
  description: string;
  collectionId: string | null;
  subjectStudentId: string | null;
  currentVersionId: string | null;
  revision: number;
  archived: boolean;
  canManage: boolean;
  createdAt: string;
  current: ResourceVersion | null;
}
export interface ResourceDetail {
  resource: PrivateResource;
  versions: ResourceVersion[];
  grants: { studentId: string; studentName: string }[];
}
export interface ResourceCapabilities {
  workerOnline: boolean;
  rendererAvailable: boolean;
  pdfUploadsConfigured: boolean;
  usedBytes: number;
  limitBytes: number;
  generatedThisMonth: number;
  monthlyLimit: number;
}
