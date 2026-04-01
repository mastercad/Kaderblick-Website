export interface UserRow {
  id: number;
  fullName: string;
  email: string;
  isVerified: boolean;
  isEnabled: boolean;
  userRelations: Array<{ relationType?: { name: string }; entity: string }>;
}

export interface RegistrationRequestRow {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  note?: string;
  user: { id: number; fullName: string; email: string };
  entityType?: 'player' | 'coach';
  entityName?: string;
  relationType?: { id: number; name: string };
  processedBy?: { id: number; name: string };
}

export interface SupporterRequestRow {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  note?: string;
  user: { id: number; fullName: string; email: string };
  processedBy?: { id: number; name: string };
}

export type RequestCounts = { pending: number; approved: number; rejected: number };
