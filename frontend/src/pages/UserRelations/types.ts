export interface UserRow {
  id: number;
  fullName: string;
  email: string;
  roles: string[];
  baseRole?: string;
  isVerified: boolean;
  isEnabled: boolean;
  lockedAt: string | null;
  userRelations: Array<{ relationType?: { name: string }; entity: string }>;
  staffTeamAssignments: Array<{ team?: { name: string }; type?: { name: string } | null }>;
  staffClubAssignments: Array<{ club?: { name: string }; type?: { name: string } | null }>;
  functionaryTeamAssignments: Array<{ team?: { name: string }; type?: { name: string } | null }>;
  functionaryClubAssignments: Array<{ club?: { name: string }; type?: { name: string } | null }>;
  adminTeamAssignments: Array<{ team?: { id: number; name: string }; startDate?: string | null; endDate?: string | null }>;
  adminClubAssignments: Array<{ club?: { id: number; name: string }; startDate?: string | null; endDate?: string | null }>;
  supporterTeamAssignments: Array<{ team?: { id: number; name: string }; startDate?: string | null; endDate?: string | null }>;
  supporterClubAssignments: Array<{ club?: { id: number; name: string }; startDate?: string | null; endDate?: string | null }>;
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
  team?: { id: number; name: string } | null;
  processedBy?: { id: number; name: string };
}

export type RequestCounts = { pending: number; approved: number; rejected: number };

export interface DemoRequestRow {
  id: number;
  name: string;
  email: string;
  clubName?: string | null;
  league?: string | null;
  ageGroup?: string | null;
  phone?: string | null;
  message?: string | null;
  status: 'pending' | 'demo_sent' | 'contacted' | 'rejected';
  adminNote?: string | null;
  createdAt: string;
  processedAt?: string | null;
  processedBy?: { id: number; name: string } | null;
}

export type DemoRequestCounts = { pending: number; demo_sent: number; contacted: number; rejected: number };
