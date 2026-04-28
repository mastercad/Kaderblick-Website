// ─── Shared participation types ───────────────────────────────────────────────
// Used by EventDetailsModal and Matchday (and any future consumer).

export interface ParticipationStatus {
  id: number;
  name: string;
  color?: string;
  icon?: string;
  code?: string;
  sort_order?: number;
}

export interface CurrentParticipation {
  statusId: number;
  statusName: string;
  color?: string;
  icon?: string;
  note?: string;
}
