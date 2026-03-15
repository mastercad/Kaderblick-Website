// ─── TacticsBoard – shared type definitions ────────────────────────────────────

import type { Formation } from '../formation/types';

export type Tool = 'pointer' | 'arrow' | 'run' | 'zone';

export interface OpponentToken {
  id: string;
  x: number; // 0-100 % within the pitch SVG coordinate system
  y: number;
  number: number;
}

export interface FieldArrow {
  id: string;
  kind: 'arrow' | 'run';
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
}

export interface FieldZone {
  id: string;
  kind: 'zone';
  cx: number; cy: number;
  r: number;
  color: string;
}

export type DrawElement = FieldArrow | FieldZone;

/** Tactic-local screen-position override for an own player (does NOT touch formation data). */
export interface PlayerPositionOverride {
  id: number; // matches PlayerData.id
  sx: number; // screen x % (0-100)
  sy: number; // screen y % (0-100)
}

/** Named tactic board snapshot – multiple per formation */
export interface TacticEntry {
  id: string;
  name: string;
  elements: DrawElement[];
  opponents: OpponentToken[];
  /** Per-player position overrides stored in the tactic, never written back to formation */
  playerPositions?: PlayerPositionOverride[];
  savedAt?: string;
}

/** @deprecated kept for backward-compat migration only */
export interface TacticsBoardData {
  elements: DrawElement[];
  opponents: OpponentToken[];
  savedAt?: string;
}

/** Live preview while the user is drawing */
export interface DrawPreview {
  x1: number; y1: number;
  x2: number; y2: number;
}

/** Drag state for a single drawing element */
export interface ElDragState {
  id: string;
  mode: 'move' | 'start' | 'end' | 'resize';
  startX: number;
  startY: number;
  hasMoved: boolean;
}

/** Drag state for an opponent token */
export interface OppDragState {
  id: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
}

/** Drag state for an own player token */
export interface OwnPlayerDragState {
  id: number; // matches PlayerData.id (number)
  startX: number; // SVG-space coordinate, updated each move (same delta pattern as OppDragState)
  startY: number;
  hasMoved: boolean;
}

export interface TacticsBoardModalProps {
  open: boolean;
  onClose: () => void;
  /** Full formation object – needed for saving board data back to the API */
  formation: Formation | null;
  onBoardSaved?: (updatedFormation: Formation) => void;
}

// ---------------------------------------------------------------------------
// Tactic Presets
// ---------------------------------------------------------------------------

export type PresetCategory =
  | 'Pressing'
  | 'Angriff'
  | 'Standards'
  | 'Spielaufbau'
  | 'Defensive';

export const PRESET_CATEGORIES: PresetCategory[] = [
  'Pressing',
  'Angriff',
  'Standards',
  'Spielaufbau',
  'Defensive',
];

/** A single loadable tactic template. */
export interface TacticPreset {
  /** Numeric id = DB record. String id = built-in/local preset. */
  id: string | number;
  title: string;
  category: PresetCategory;
  description: string;
  isSystem: boolean;
  /** Set when the preset belongs to a club (team-sharing). */
  clubId?: number;
  /** Human-readable name of the creator (undefined for system presets). */
  createdBy?: string;
  /** Whether the requesting user may delete this preset. */
  canDelete: boolean;
  /** The actual board data – same shape as TacticEntry minus the tab-level id. */
  data: Omit<TacticEntry, 'id'>;
}
