import type { QuickEventConfig } from '../../../modals/quick-event/types';

export interface QuickEventPreset {
  id: number;
  name: string;
  config: QuickEventConfig;
  isActive: boolean;
  ownerId: number;
  sharedWithUserIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ShareableUser {
  id: number;
  fullName: string;
}
