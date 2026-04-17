// ─── Shared Types for EventDetailsModal ─────────────────────────────────────

export interface ParticipationStatus {
  id: number;
  name: string;
  color?: string;
  icon?: string;
  code: string;
  sort_order: number;
}

export interface Participation {
  user_id: number;
  user_name: string;
  is_team_player: boolean;
  note?: string;
  status: {
    id: number;
    name: string;
    color?: string;
    icon?: string;
    code: string;
  };
}

export interface CurrentParticipation {
  statusId: number;
  statusName: string;
  color?: string;
  icon?: string;
  note?: string;
}

export interface EventLocation {
  name?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  address?: string;
}

export interface EventGame {
  homeTeam?: { name: string };
  awayTeam?: { name: string };
  gameType?: { name: string };
  round?: string | null;
}

export interface EventTask {
  id: number;
  isRecurring: boolean;
  recurrenceMode: string;
  recurrenceRule: string | null;
  rotationUsers: { id: number; fullName: string }[];
  rotationCount: number;
}

export interface EventPermissions {
  canEdit?: boolean;
  canDelete?: boolean;
  canCancel?: boolean;
  canViewRides?: boolean;
  canParticipate?: boolean;
}

export interface CalendarEventType {
  name?: string;
  color?: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  start: Date | string;
  end: Date | string;
  description?: string;
  type?: CalendarEventType;
  location?: EventLocation;
  weatherData?: { weatherCode?: number };
  game?: EventGame;
  task?: EventTask;
  permissions?: EventPermissions;
  cancelled?: boolean;
  cancelReason?: string;
  cancelledBy?: string;
  meetingPoint?: string;
  meetingTime?: string;
  meetingLocation?: {
    id: number;
    name: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    city?: string;
  };
}

export interface EventDetailsModalProps {
  open: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onEdit?: () => void;
  showEdit?: boolean;
  onDelete?: () => void;
  onCancelled?: () => void;
  onUpdated?: () => void;
  // Legacy props – unused in refactored version but kept for compatibility
  participationStatuses?: ParticipationStatus[];
  currentParticipation?: CurrentParticipation;
  participations?: unknown[];
  onParticipationChange?: (statusId: number, note: string) => void;
  loadingParticipation?: boolean;
  initialOpenRides?: boolean;
}

// ─── Player Overview API Types ───────────────────────────────────────────────

export interface TeamOverviewMember {
  user_id: number;
  user_name: string;
  participation: {
    status_id: number;
    status_name: string;
    status_code: string;
    status_color?: string;
    note?: string;
  } | null;
}

export interface TeamOverview {
  id: number;
  name: string;
  members: TeamOverviewMember[];
}

export interface EventOverviewResponse {
  teams: TeamOverview[];
  my_team_id: number | null;
}
