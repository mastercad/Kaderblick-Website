// ─── Shared type definitions for the Formation editor ─────────────────────────

/** Origin of a dragged token – used by field pointer/touch drag. */
export type DragSource = 'field' | 'bench';

export interface Player {
  id: number;
  name: string;
  shirtNumber?: string | number;
  /** Main position abbreviation from backend (e.g. 'TW', 'IV', 'ZM', 'ST') */
  position?: string | null;
  /** Alternative position abbreviations (e.g. ['ZM', 'DM']) */
  alternativePositions?: string[];
}

export interface Team {
  id: number;
  name: string;
  /** True when the authenticated user is directly assigned to this team. */
  assigned?: boolean;
}

export interface FormationType {
  id?: number;
  name: string;
  cssClass?: string;
  backgroundPath?: string;
}

export interface PlayerData {
  id: number;
  x: number;
  y: number;
  number: string | number;
  name: string;
  playerId?: number | null;
  isRealPlayer?: boolean;
  position?: string;
  /** Alternativpositionen – für Debug-Tooltip und Positionszuweisung. */
  alternativePositions?: string[];
}

export interface FormationData {
  code?: string;
  players?: PlayerData[];
  bench?: PlayerData[];
  notes?: string;
  /** @deprecated use tacticsBoardDataArr */
  tacticsBoardData?: unknown;
  /** Named tactic entries – multiple per formation */
  tacticsBoardDataArr?: unknown;
}

export interface FormationEditorDraft {
  name: string;
  selectedTeam: number | '';
  formationData: FormationData;
}

export interface Formation {
  id: number;
  name: string;
  formationType: FormationType;
  formationData: FormationData;
}

export interface FormationEditModalProps {
  open: boolean;
  formationId: number | null;
  onClose: () => void;
  onSaved?: (formation: Formation) => void;
  initialDraft?: FormationEditorDraft;
  title?: string;
  saveButtonLabel?: string;
  onSaveDraft?: (draft: FormationEditorDraft) => Promise<void> | void;
  initialShowTemplatePicker?: boolean;
}
