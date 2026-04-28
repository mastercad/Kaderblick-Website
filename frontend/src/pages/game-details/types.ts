import React from 'react';

export interface GameDetailsProps {
  gameId?: number;
  onBack?: () => void;
}

export type DetailSectionKey = 'matchPlan' | 'events' | 'videos' | 'timing';

export interface DetailSectionHeaderProps {
  icon: React.ReactNode;
  label: string;
  count?: React.ReactNode;
  color: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  testId?: string;
}
