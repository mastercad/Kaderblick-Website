import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import type { DragSource, Formation, FormationEditorDraft, Player, PlayerData, Team } from './types';
import type { FormationTemplate } from './templates';
import { useFormationData } from './useFormationData';
import { useFieldDrag } from './useFieldDrag';
import { useSquadDrop } from './useSquadDrop';
import { usePlayerActions } from './usePlayerActions';
import { useFormationSave } from './useFormationSave';
import { useUndoRedo } from './useUndoRedo';
const AUTO_SNAP_STORAGE_KEY = 'formation-editor:auto-snap';

const loadAutoSnapPreference = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(AUTO_SNAP_STORAGE_KEY) === '1';
};

export interface FormationEditorState {
  // data
  formation: Formation | null;
  currentTemplateCode: string | null;
  players: PlayerData[];
  benchPlayers: PlayerData[];
  availablePlayers: Player[];
  teams: Team[];
  // form fields
  name: string;
  notes: string;
  selectedTeam: number | '';
  // ui state
  loading: boolean;
  error: string | null;
  isDirty: boolean;
  searchQuery: string;
  showTemplatePicker: boolean;
  autoSnapEnabled: boolean;
  draggedPlayerId: number | null;
  isDraggingFromBench: boolean;
  pitchRef: React.RefObject<HTMLDivElement | null>;
  /** Map von Spieler-ID → DOM-Element des Tokens – übergeben an PlayerToken.domRef */
  tokenRefs: React.RefObject<Map<number, HTMLDivElement>>;
  // setters
  setName: (v: string) => void;
  setNotes: (v: string) => void;
  setSelectedTeam: (v: number | '') => void;
  setSearchQuery: (v: string) => void;
  setShowTemplatePicker: (v: boolean) => void;
  setCurrentTemplateCode: (v: string | null) => void;
  setAutoSnapEnabled: (v: boolean) => void;
  // derived ui helpers
  hasPlaceholders: boolean;
  placeholderCount: number;
  // squad drag-and-drop
  squadDragPlayer: Player | null;
  highlightedTokenId: number | null;
  squadGhostRef: React.RefObject<HTMLDivElement | null>;
  benchGhostRef: React.RefObject<HTMLDivElement | null>;
  // actions
  applyTemplate: (t: FormationTemplate) => void;
  fillWithTeamPlayers: () => void;
  addPlayerToFormation: (p: Player, target: DragSource) => void;
  addGenericPlayer: () => void;
  removePlayer: (id: number) => void;
  removeBenchPlayer: (id: number) => void;
  sendToBench: (id: number) => void;
  sendToField: (id: number) => void;
  handlePitchMouseMove: (e: React.MouseEvent) => void;
  handlePitchMouseUp: () => void;
  handlePitchTouchMove: (e: React.TouchEvent) => void;
  handlePitchTouchEnd: () => void;
  startDragFromField: (id: number, e: React.MouseEvent | React.TouchEvent) => void;
  startDragFromBench: (id: number, e: React.MouseEvent | React.TouchEvent) => void;
  // squad DnD (HTML5 drag from squad list onto pitch)
  handleSquadDragStart: (player: Player) => void;
  handleSquadDragEnd: () => void;
  handlePitchDragOver: (e: React.DragEvent) => void;
  handlePitchDrop: (e: React.DragEvent) => void;
  handleSave: () => Promise<void>;
  // ── Undo / Redo ───────────────────────────────────────────────────────
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

interface FormationDraftSnapshotParams {
  name: string;
  notes: string;
  selectedTeam: number | '';
  currentTemplateCode: string | null;
  players: PlayerData[];
  benchPlayers: PlayerData[];
}

function normalizePlayerData(player: PlayerData) {
  return {
    id: player.id,
    x: player.x,
    y: player.y,
    number: player.number,
    name: player.name,
    playerId: player.playerId ?? null,
    isRealPlayer: player.isRealPlayer ?? false,
    position: player.position ?? null,
    alternativePositions: [...(player.alternativePositions ?? [])],
  };
}

export function buildFormationDraftSnapshot({
  name,
  notes,
  selectedTeam,
  currentTemplateCode,
  players,
  benchPlayers,
}: FormationDraftSnapshotParams): string {
  return JSON.stringify({
    name,
    notes,
    selectedTeam,
    currentTemplateCode,
    players: [...players]
      .map(normalizePlayerData)
      .sort((a, b) => a.id - b.id),
    benchPlayers: [...benchPlayers]
      .map(normalizePlayerData)
      .sort((a, b) => a.id - b.id),
  });
}

export function useFormationEditor(
  open: boolean,
  formationId: number | null,
  onClose: () => void,
  onSaved?: (f: Formation) => void,
  initialDraft?: FormationEditorDraft,
  onSaveDraft?: (draft: FormationEditorDraft) => Promise<void> | void,
  saveSuccessMessage?: string,
  initialShowTemplatePicker?: boolean,
): FormationEditorState {
  const { showToast } = useToast();
  const pitchRef = useRef<HTMLDivElement>(null);
  /** Stable map von Spieler-ID → DOM-Element des Tokens für direktes DOM-Update während Drag. */
  const tokenRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const initialSnapshotRef = useRef<string | null>(null);
  const dirtyTrackingReadyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const [autoSnapEnabled, setAutoSnapEnabled] = useState(loadAutoSnapPreference);

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const undoRedo = useUndoRedo();
  // Refs zum stabilen Lesen von current players/bench ohne Closure-Stale
  const playersRef = useRef<PlayerData[]>([]);
  const benchPlayersRef = useRef<PlayerData[]>([]);

  // ── State + API-Calls ────────────────────────────────────────────────────
  const data = useFormationData(open, formationId, initialDraft, initialShowTemplatePicker);

  // Refs in sync halten
  useEffect(() => { playersRef.current = data.players; }, [data.players]);
  useEffect(() => { benchPlayersRef.current = data.benchPlayers; }, [data.benchPlayers]);

  /** Snapshot des aktuellen Zustands in den Undo-Stack schieben (vor einer Aktion aufrufen). */
  const pushSnapshot = useCallback(() => {
    undoRedo.push(playersRef.current, benchPlayersRef.current);
  }, [undoRedo]);

  // ── Pointer/Touch-Drag für Feld-Tokens ──────────────────────────────────
  const fieldDrag = useFieldDrag({
    autoSnapEnabled,
    currentTemplateCode: data.currentTemplateCode,
    players:        data.players,
    setPlayers:     data.setPlayers,
    benchPlayers:   data.benchPlayers,
    setBenchPlayers: data.setBenchPlayers,
    pitchRef,
    tokenRefs,
  });

  // ── HTML5-Drag vom Squad-Panel aufs Feld ────────────────────────────────
  const squadDrop = useSquadDrop({
    autoSnapEnabled,
    currentTemplateCode: data.currentTemplateCode,
    players:            data.players,
    setPlayers:         data.setPlayers,
    benchPlayers:       data.benchPlayers,
    setBenchPlayers:    data.setBenchPlayers,
    nextPlayerNumber:   data.nextPlayerNumber,
    setNextPlayerNumber: data.setNextPlayerNumber,
    pitchRef,
  });

  // ── Spielerverwaltung, Template-Anwendung, Auto-Fill ────────────────────
  const playerActions = usePlayerActions({
    players:            data.players,
    setPlayers:         data.setPlayers,
    benchPlayers:       data.benchPlayers,
    setBenchPlayers:    data.setBenchPlayers,
    setCurrentTemplateCode: data.setCurrentTemplateCode,
    availablePlayers:   data.availablePlayers,
    nextPlayerNumber:   data.nextPlayerNumber,
    setNextPlayerNumber: data.setNextPlayerNumber,
    setShowTemplatePicker: data.setShowTemplatePicker,
    showToast,
  });

  // ── Speichern ────────────────────────────────────────────────────────────
  const { handleSave } = useFormationSave({
    formation:    data.formation,
    currentTemplateCode: data.currentTemplateCode,
    players:      data.players,
    benchPlayers: data.benchPlayers,
    notes:        data.notes,
    name:         data.name,
    selectedTeam: data.selectedTeam,
    formationId,
    setLoading:   data.setLoading,
    setError:     data.setError,
    showToast,
    onClose,
    onSaved,
    onSaveDraft,
    saveSuccessMessage,
  });

  const currentSnapshot = useMemo(() => buildFormationDraftSnapshot({
    name: data.name,
    notes: data.notes,
    selectedTeam: data.selectedTeam,
    currentTemplateCode: data.currentTemplateCode,
    players: data.players,
    benchPlayers: data.benchPlayers,
  }), [data.name, data.notes, data.selectedTeam, data.currentTemplateCode, data.players, data.benchPlayers]);

  useEffect(() => {
    if (!open) {
      initialSnapshotRef.current = null;
      dirtyTrackingReadyRef.current = false;
      setIsDirty(false);
      undoRedo.reset();
    }
  }, [open, undoRedo]);

  useEffect(() => {
    if (!open) return;

    const readyForDirtyTracking = !data.loading && (
      (formationId
        ? Boolean(data.formation) || Boolean(data.error)
        : data.selectedTeam !== '' || data.teams.length > 0 || Boolean(data.error))
    );

    if (!readyForDirtyTracking) return;

    if (!dirtyTrackingReadyRef.current) {
      initialSnapshotRef.current = currentSnapshot;
      dirtyTrackingReadyRef.current = true;
      setIsDirty(false);
      return;
    }

    setIsDirty(currentSnapshot !== initialSnapshotRef.current);
  }, [
    currentSnapshot,
    data.error,
    data.formation,
    data.loading,
    data.selectedTeam,
    data.teams.length,
    formationId,
    open,
  ]);

  useEffect(() => {
    if (!open || !isDirty) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [open, isDirty]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(AUTO_SNAP_STORAGE_KEY, autoSnapEnabled ? '1' : '0');
  }, [autoSnapEnabled]);

  return {
    // ── Daten & Formularfelder ────────────────────────────────────────────
    formation:          data.formation,
    currentTemplateCode: data.currentTemplateCode,
    players:            data.players,
    benchPlayers:       data.benchPlayers,
    availablePlayers:   data.availablePlayers,
    teams:              data.teams,
    name:               data.name,
    notes:              data.notes,
    selectedTeam:       data.selectedTeam,
    loading:            data.loading,
    error:              data.error,
    isDirty,
    searchQuery:        data.searchQuery,
    showTemplatePicker: data.showTemplatePicker,
    autoSnapEnabled,
    setName:            data.setName,
    setNotes:           data.setNotes,
    setSelectedTeam:    data.setSelectedTeam,
    setSearchQuery:     data.setSearchQuery,
    setShowTemplatePicker: data.setShowTemplatePicker,
    setCurrentTemplateCode: data.setCurrentTemplateCode,
    setAutoSnapEnabled,
    pitchRef,
    // ── Pointer/Touch-Drag (Feld-Tokens) ─────────────────────────────────
    tokenRefs,
    draggedPlayerId:    fieldDrag.draggedPlayerId,
    isDraggingFromBench: fieldDrag.isDraggingFromBench,
    // Snapshot vor Drag-Start (pre-drag state), nicht beim Move
    startDragFromField: useCallback((id: number, e: React.MouseEvent | React.TouchEvent) => {
      pushSnapshot();
      fieldDrag.startDragFromField(id, e);
    }, [pushSnapshot, fieldDrag.startDragFromField]),
    startDragFromBench: useCallback((id: number, e: React.MouseEvent | React.TouchEvent) => {
      pushSnapshot();
      fieldDrag.startDragFromBench(id, e);
    }, [pushSnapshot, fieldDrag.startDragFromBench]),
    handlePitchMouseMove: fieldDrag.handlePitchMouseMove,
    handlePitchMouseUp:   fieldDrag.handlePitchMouseUp,
    handlePitchTouchMove: fieldDrag.handlePitchTouchMove,
    handlePitchTouchEnd:  fieldDrag.handlePitchTouchEnd,
    // ── HTML5-Drag vom Squad-Panel ────────────────────────────────────────
    squadDragPlayer:    squadDrop.squadDragPlayer,
    highlightedTokenId: squadDrop.highlightedTokenId,
    squadGhostRef:      squadDrop.squadGhostRef,
    benchGhostRef:      fieldDrag.benchGhostRef,
    handleSquadDragStart: squadDrop.handleSquadDragStart,
    handleSquadDragEnd:   squadDrop.handleSquadDragEnd,
    handlePitchDragOver:  squadDrop.handlePitchDragOver,
    handlePitchDrop: useCallback((e: React.DragEvent) => {
      pushSnapshot();
      squadDrop.handlePitchDrop(e);
    }, [pushSnapshot, squadDrop.handlePitchDrop]),
    // ── Spielerverwaltung & Auto-Fill ─────────────────────────────────────
    hasPlaceholders:    playerActions.hasPlaceholders,
    placeholderCount:   playerActions.placeholderCount,
    applyTemplate: useCallback((t: FormationTemplate) => {
      pushSnapshot();
      playerActions.applyTemplate(t);
    }, [pushSnapshot, playerActions.applyTemplate]),
    fillWithTeamPlayers: useCallback(() => {
      pushSnapshot();
      playerActions.fillWithTeamPlayers();
    }, [pushSnapshot, playerActions.fillWithTeamPlayers]),
    addPlayerToFormation: useCallback((p: Player, target: DragSource) => {
      pushSnapshot();
      playerActions.addPlayerToFormation(p, target);
    }, [pushSnapshot, playerActions.addPlayerToFormation]),
    addGenericPlayer: useCallback(() => {
      pushSnapshot();
      playerActions.addGenericPlayer();
    }, [pushSnapshot, playerActions.addGenericPlayer]),
    removePlayer: useCallback((id: number) => {
      pushSnapshot();
      playerActions.removePlayer(id);
    }, [pushSnapshot, playerActions.removePlayer]),
    removeBenchPlayer: useCallback((id: number) => {
      pushSnapshot();
      playerActions.removeBenchPlayer(id);
    }, [pushSnapshot, playerActions.removeBenchPlayer]),
    sendToBench: useCallback((id: number) => {
      pushSnapshot();
      playerActions.sendToBench(id);
    }, [pushSnapshot, playerActions.sendToBench]),
    sendToField: useCallback((id: number) => {
      pushSnapshot();
      playerActions.sendToField(id);
    }, [pushSnapshot, playerActions.sendToField]),
    // ── Speichern ─────────────────────────────────────────────────────────
    handleSave,
    // ── Undo / Redo ───────────────────────────────────────────────────────
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    undo: useCallback(() => {
      undoRedo.undo(playersRef.current, benchPlayersRef.current, data.setPlayers, data.setBenchPlayers);
    }, [undoRedo, data.setPlayers, data.setBenchPlayers]),
    redo: useCallback(() => {
      undoRedo.redo(playersRef.current, benchPlayersRef.current, data.setPlayers, data.setBenchPlayers);
    }, [undoRedo, data.setPlayers, data.setBenchPlayers]),
  };
}
