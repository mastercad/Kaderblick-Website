import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import type { DragSource, Formation, Player, PlayerData, Team } from './types';
import type { FormationTemplate } from './templates';
import { useFormationData } from './useFormationData';
import { useFieldDrag } from './useFieldDrag';
import { useSquadDrop } from './useSquadDrop';
import { usePlayerActions } from './usePlayerActions';
import { useFormationSave } from './useFormationSave';

export interface FormationEditorState {
  // data
  formation: Formation | null;
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
  draggedPlayerId: number | null;
  pitchRef: React.RefObject<HTMLDivElement | null>;
  /** Map von Spieler-ID → DOM-Element des Tokens – übergeben an PlayerToken.domRef */
  tokenRefs: React.RefObject<Map<number, HTMLDivElement>>;
  // setters
  setName: (v: string) => void;
  setNotes: (v: string) => void;
  setSelectedTeam: (v: number | '') => void;
  setSearchQuery: (v: string) => void;
  setShowTemplatePicker: (v: boolean) => void;
  // derived ui helpers
  hasPlaceholders: boolean;
  placeholderCount: number;
  // squad drag-and-drop
  squadDragPlayer: Player | null;
  highlightedTokenId: number | null;
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
}

interface FormationDraftSnapshotParams {
  name: string;
  notes: string;
  selectedTeam: number | '';
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
  players,
  benchPlayers,
}: FormationDraftSnapshotParams): string {
  return JSON.stringify({
    name,
    notes,
    selectedTeam,
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
): FormationEditorState {
  const { showToast } = useToast();
  const pitchRef = useRef<HTMLDivElement>(null);
  /** Stable map von Spieler-ID → DOM-Element des Tokens für direktes DOM-Update während Drag. */
  const tokenRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const initialSnapshotRef = useRef<string | null>(null);
  const dirtyTrackingReadyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);

  // ── State + API-Calls ────────────────────────────────────────────────────
  const data = useFormationData(open, formationId);

  // ── Pointer/Touch-Drag für Feld-Tokens ──────────────────────────────────
  const fieldDrag = useFieldDrag({
    players:        data.players,
    setPlayers:     data.setPlayers,
    benchPlayers:   data.benchPlayers,
    setBenchPlayers: data.setBenchPlayers,
    pitchRef,
    tokenRefs,
  });

  // ── HTML5-Drag vom Squad-Panel aufs Feld ────────────────────────────────
  const squadDrop = useSquadDrop({
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
    availablePlayers:   data.availablePlayers,
    nextPlayerNumber:   data.nextPlayerNumber,
    setNextPlayerNumber: data.setNextPlayerNumber,
    setShowTemplatePicker: data.setShowTemplatePicker,
    showToast,
  });

  // ── Speichern ────────────────────────────────────────────────────────────
  const { handleSave } = useFormationSave({
    formation:    data.formation,
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
  });

  const currentSnapshot = useMemo(() => buildFormationDraftSnapshot({
    name: data.name,
    notes: data.notes,
    selectedTeam: data.selectedTeam,
    players: data.players,
    benchPlayers: data.benchPlayers,
  }), [data.name, data.notes, data.selectedTeam, data.players, data.benchPlayers]);

  useEffect(() => {
    if (!open) {
      initialSnapshotRef.current = null;
      dirtyTrackingReadyRef.current = false;
      setIsDirty(false);
    }
  }, [open]);

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

  return {
    // ── Daten & Formularfelder ────────────────────────────────────────────
    formation:          data.formation,
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
    setName:            data.setName,
    setNotes:           data.setNotes,
    setSelectedTeam:    data.setSelectedTeam,
    setSearchQuery:     data.setSearchQuery,
    setShowTemplatePicker: data.setShowTemplatePicker,
    pitchRef,
    // ── Pointer/Touch-Drag (Feld-Tokens) ─────────────────────────────────
    tokenRefs,
    draggedPlayerId:    fieldDrag.draggedPlayerId,
    startDragFromField: fieldDrag.startDragFromField,
    startDragFromBench: fieldDrag.startDragFromBench,
    handlePitchMouseMove: fieldDrag.handlePitchMouseMove,
    handlePitchMouseUp:   fieldDrag.handlePitchMouseUp,
    handlePitchTouchMove: fieldDrag.handlePitchTouchMove,
    handlePitchTouchEnd:  fieldDrag.handlePitchTouchEnd,
    // ── HTML5-Drag vom Squad-Panel ────────────────────────────────────────
    squadDragPlayer:    squadDrop.squadDragPlayer,
    highlightedTokenId: squadDrop.highlightedTokenId,
    handleSquadDragStart: squadDrop.handleSquadDragStart,
    handleSquadDragEnd:   squadDrop.handleSquadDragEnd,
    handlePitchDragOver:  squadDrop.handlePitchDragOver,
    handlePitchDrop:      squadDrop.handlePitchDrop,
    // ── Spielerverwaltung & Auto-Fill ─────────────────────────────────────
    hasPlaceholders:    playerActions.hasPlaceholders,
    placeholderCount:   playerActions.placeholderCount,
    applyTemplate:         playerActions.applyTemplate,
    fillWithTeamPlayers:   playerActions.fillWithTeamPlayers,
    addPlayerToFormation:  playerActions.addPlayerToFormation,
    addGenericPlayer:      playerActions.addGenericPlayer,
    removePlayer:          playerActions.removePlayer,
    removeBenchPlayer:     playerActions.removeBenchPlayer,
    sendToBench:           playerActions.sendToBench,
    sendToField:           playerActions.sendToField,
    // ── Speichern ─────────────────────────────────────────────────────────
    handleSave,
  };
}
