// ─── TacticsBoard – main state hook ───────────────────────────────────────────
import { useRef, useState, useCallback, useEffect, useId } from 'react';
import React from 'react';
import { apiJson } from '../../utils/api';
import type { Formation, PlayerData } from '../formation/types';
import {
  Tool, DrawElement, FieldZone, FieldArrow, OpponentToken, TacticEntry, TacticsBoardData,
  ElDragState, OppDragState, OwnPlayerDragState, PlayerPositionOverride,
} from './types';
import type { TacticPreset } from './types';
import { svgCoords, makeMarkerId, arrowPath, clipLine } from './utils';
import { PALETTE } from './constants';

const SAVE_MSG_TIMEOUT_MS = 3500;
const DRAFT_SAVE_DEBOUNCE_MS = 250;
const LOCAL_DRAFT_VERSION = 1;

interface LocalTacticsBoardDraft {
  version: number;
  formationId: number;
  updatedAt: string;
  tactics: TacticEntry[];
  activeTacticId: string;
  fullPitch: boolean;
}

function getDraftStorageKey(formationId: number) {
  return `tactics-board-draft:${formationId}`;
}

function readLocalDraft(formationId: number): LocalTacticsBoardDraft | null {
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(formationId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LocalTacticsBoardDraft>;
    if (
      parsed.version !== LOCAL_DRAFT_VERSION
      || parsed.formationId !== formationId
      || !Array.isArray(parsed.tactics)
      || typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }

    return {
      version: LOCAL_DRAFT_VERSION,
      formationId,
      updatedAt: parsed.updatedAt,
      tactics: parsed.tactics,
      activeTacticId: typeof parsed.activeTacticId === 'string' ? parsed.activeTacticId : '',
      fullPitch: typeof parsed.fullPitch === 'boolean' ? parsed.fullPitch : true,
    };
  } catch {
    return null;
  }
}

function writeLocalDraft(draft: LocalTacticsBoardDraft) {
  try {
    window.localStorage.setItem(getDraftStorageKey(draft.formationId), JSON.stringify(draft));
  } catch {
    // Ignore quota and privacy-mode failures; the board still works in-memory.
  }
}

function clearLocalDraft(formationId: number) {
  try {
    window.localStorage.removeItem(getDraftStorageKey(formationId));
  } catch {
    // Ignore storage errors.
  }
}

function getLatestSavedAt(entries: TacticEntry[]) {
  const timestamps = entries
    .map(entry => entry.savedAt)
    .filter((value): value is string => typeof value === 'string')
    .map(value => Date.parse(value))
    .filter(value => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return Math.max(...timestamps);
}

// ─── Coordinate transforms between pitch modes ────────────────────────────────
//
// Both modes use SVG viewBox 0 0 100 100. The pitch areas they show differ:
//
// Full-pitch LANDSCAPE (1920×1357):
//   SVG-x = pitch length: 0 = opponent goal, 100 = own goal
//   SVG-y = pitch width:  0 = top, 100 = bottom
//   Own half: SVG-x ∈ [50, 100]
//
// Half-pitch LANDSCAPE (1357×960):
//   SVG-x = pitch width:  0 = left touchline, 100 = right touchline
//   SVG-y = pitch depth:  0 = midfield/attack, 100 = own goal
//
// Transform formulas (NO clamping – out-of-range values are fine, the SVG
// viewBox clips them automatically, preserving arrow lengths on full-pitch):
//
// The half-pitch x-axis runs left→right (x=0 = left touchline, x=100 = right).
// The full-pitch y-axis runs top→bottom (y=0 = top touchline, y=100 = bottom).
// Crucially: full-pitch TOP (y=0) corresponds to half-pitch RIGHT (x=100),
// i.e. the field is viewed as a 90° CCW rotation from landscape → portrait.
//
//   full → half:  x_h = 100 – y_f       y_h = (x_f – 50) × 2
//   half → full:  x_f = 50 + y_h / 2    y_f = 100 – x_h

function fullToHalfPt(x: number, y: number) {
  return { x: 100 - y, y: (x - 50) * 2 };
}

function halfToFullPt(x: number, y: number) {
  return { x: 50 + y * 0.5, y: 100 - x };
}

function transformEl(
  el: DrawElement,
  fn: (x: number, y: number) => { x: number; y: number },
): DrawElement {
  if (el.kind === 'arrow' || el.kind === 'run') {
    const p1 = fn(el.x1, el.y1); const p2 = fn(el.x2, el.y2);
    return { ...el, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }
  const p = fn((el as FieldZone).cx, (el as FieldZone).cy);
  return { ...el, cx: p.x, cy: p.y } as FieldZone;
}

function transformOpp(
  opp: OpponentToken,
  fn: (x: number, y: number) => { x: number; y: number },
): OpponentToken {
  const p = fn(opp.x, opp.y);
  return { ...opp, x: p.x, y: p.y };
}

function transformPlayerPos(
  pp: PlayerPositionOverride,
  fn: (x: number, y: number) => { x: number; y: number },
): PlayerPositionOverride {
  const p = fn(pp.sx, pp.sy);
  return { ...pp, sx: p.x, sy: p.y };
}
// ─── Drag-origin types (stored in refs – never updated during drag) ────────────
// Using immutable origins + absolute math avoids the stale-closure drift that
// occurs when React batches mousemove state updates.

interface ElDragOrigin {
  id: string;
  mode: 'move' | 'start' | 'end' | 'resize';
  mouseX: number;        // SVG-unit position of pointer at drag start
  mouseY: number;
  el: DrawElement;       // snapshot of element at drag start
  hasMoved: boolean;
  svgRect: DOMRect;       // cached once at drag-start – no more getBCR per frame
  domGroup: SVGGElement | null;       // <g> for imperative transform during 'move' drag
  liveX: number;                      // latest dx (SVG units) – written each frame, read on commit
  liveY: number;                      // latest dy (SVG units)
  // Child element refs for imperative handle-drag updates (zero React re-renders)
  domVisualPath:   SVGPathElement     | null; // arrow: visual path
  domHitPath:      SVGPathElement     | null; // arrow: transparent hit area
  domStartHandle:  SVGGElement        | null; // arrow: start handle <g>
  domEndHandle:    SVGGElement        | null; // arrow: end handle <g>
  domBodyEllipse:  SVGEllipseElement  | null; // zone: main ellipse
  domResizeHandle: SVGGElement        | null; // zone: resize handle <g>
  domBadgeEllipse: SVGEllipseElement  | null; // step-number badge ellipse
  domBadgeText:    SVGTextElement     | null; // step-number badge text
  liveElData: DrawElement | null;             // latest geometry for handle drags, committed on mouseup
}

interface OppDragOrigin {
  id: string;
  mouseX: number;
  mouseY: number;
  x: number;
  y: number;
  hasMoved: boolean;
  svgRect: DOMRect;
  domEl: HTMLElement | null; // opponent div for direct style updates
  liveDx: number;
  liveDy: number;
}

interface OwnPlayerDragOrigin {
  id: number;
  mouseX: number;
  mouseY: number;
  sx: number;
  sy: number;
  hasMoved: boolean;
  svgRect: DOMRect;
  domEl: HTMLElement | null; // player div for direct style updates
  liveDx: number;
  liveDy: number;
}
// ─── Return type ──────────────────────────────────────────────────────────────

export interface TacticsBoardState {
  // Refs
  svgRef: React.RefObject<SVGSVGElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  pitchRef: React.RefObject<HTMLDivElement | null>;

  // Tool / color
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;

  // Tactics
  tactics: TacticEntry[];
  setTactics: React.Dispatch<React.SetStateAction<TacticEntry[]>>;
  activeTacticId: string;
  setActiveTacticId: (id: string) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;

  // UI toggles
  fullPitch: boolean;
  setFullPitch: React.Dispatch<React.SetStateAction<boolean>>;
  isBrowserFS: boolean;
  showNotes: boolean;
  setShowNotes: React.Dispatch<React.SetStateAction<boolean>>;

  // Save
  saving: boolean;
  saveMsg: { ok: boolean; text: string } | null;
  isDirty: boolean;

  // Drag
  elDrag: ElDragState | null;
  oppDrag: OppDragState | null;
  ownPlayerDrag: OwnPlayerDragState | null;

  // Derived
  elements: DrawElement[];
  opponents: OpponentToken[];
  activeTactic: TacticEntry | undefined;
  pitchAX: number;
  pitchAspect: string;
  svgCursor: string;
  ownPlayers: Array<PlayerData & { sx: number; sy: number }>;
  formationName: string;
  formationCode: string | undefined;
  notes: string | undefined;
  markerId: (hex: string, kind: 'solid' | 'dashed') => string;

  // Handlers
  handleAddOpponent: () => void;
  handleOppDblClick: (id: string) => void;
  handleOppEditSave: (id: string, number: number, name: string) => void;
  handleOppEditClose: () => void;
  editingOppId: string | null;
  handleSave: () => Promise<void>;
  handleSvgDown: (e: React.MouseEvent | React.TouchEvent) => void;
  handleSvgMove: (e: React.MouseEvent | React.TouchEvent) => void;
  handleSvgUp: () => void;
  handleSvgLeave: () => void;
  handleElDown: (
    e: React.MouseEvent | React.TouchEvent,
    id: string,
    mode?: 'move' | 'start' | 'end' | 'resize',
  ) => void;
  handleOppDown: (e: React.MouseEvent | React.TouchEvent, id: string) => void;
  handleOwnPlayerDown: (e: React.MouseEvent | React.TouchEvent, id: number, sx: number, sy: number) => void;
  handleClear: () => void;
  handleUndo: () => void;
  canUndo: boolean;
  handleRedo: () => void;
  canRedo: boolean;
  handleResetPlayerPositions: () => void;
  handleNewTactic: () => void;
  handleDeleteTactic: (id: string) => void;
  /** Load a tactic preset as a new tab (never overwrites existing work). */
  handleLoadPreset: (preset: TacticPreset) => void;
  confirmRename: () => void;
  toggleFullscreen: () => Promise<void>;

  // Selection
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  handleDeleteSelected: () => void;

  // Interactive layer filter

  // DOM ref registration (called by PitchCanvas to register rendered elements)
  registerElRef: (id: string, el: SVGGElement | null) => void;
  registerOppRef: (id: string, el: HTMLElement | null) => void;
  registerPlayerRef: (id: number, el: HTMLElement | null) => void;
  registerPreviewPathRef: (el: SVGPathElement | null) => void;
  registerPreviewEllipseRef: (el: SVGEllipseElement | null) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTacticsBoard(
  open: boolean,
  formation: Formation | null,
  onBoardSaved?: (updatedFormation: Formation) => void,
): TacticsBoardState {
  const uid          = useId();
  const svgRef       = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pitchRef     = useRef<HTMLDivElement>(null);

  // ── Tool / color ──────────────────────────────────────────────────────────
  const [tool, setTool]   = useState<Tool>('arrow');
  const [color, setColorState] = useState(PALETTE[0].value);

  // ── Multi-tactic state ────────────────────────────────────────────────────
  const [tactics, setTactics]               = useState<TacticEntry[]>([]);
  const [activeTacticId, setActiveTacticId] = useState<string>('');
  const [renamingId, setRenamingId]         = useState<string | null>(null);
  const [renameValue, setRenameValue]       = useState('');

  // ── UI toggles ────────────────────────────────────────────────────────────
  const [fullPitch, setFullPitch]     = useState(true);
  const [isBrowserFS, setIsBrowserFS] = useState(false);
  const [showNotes, setShowNotes]     = useState(false);

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // ── Opponent-edit dialog state ────────────────────────────────────────────
  const [editingOppId, setEditingOppId] = useState<string | null>(null);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Drag state (React state: used only for visual feedback / cursor) ─────────
  const [elDrag, setElDrag]               = useState<ElDragState        | null>(null);
  const [oppDrag, setOppDrag]             = useState<OppDragState       | null>(null);
  const [ownPlayerDrag, setOwnPlayerDrag] = useState<OwnPlayerDragState | null>(null);

  // ── Drag origin refs (always current – used in move handler) ──────────────────
  // Storing immutable drag origins in refs instead of depending on stale closure
  // values ensures that fast mouse movements don't cause objects to drift.
  const elDragOrigin        = useRef<ElDragOrigin        | null>(null);
  const oppDragOrigin       = useRef<OppDragOrigin       | null>(null);
  const ownPlayerDragOrigin = useRef<OwnPlayerDragOrigin | null>(null);

  // ── DOM-element ref Maps – registered by PitchCanvas on mount/unmount ─────────
  // All drag types bypass React setState during drag for smooth 60fps updates.
  const elDomRefs     = useRef<Map<string, SVGGElement>>(new Map());
  const oppDomRefs    = useRef<Map<string, HTMLElement>>(new Map());
  const playerDomRefs = useRef<Map<number, HTMLElement>>(new Map());
  const undoStack     = useRef<TacticEntry[][]>([]);
  const redoStack     = useRef<TacticEntry[][]>([]);
  const tacticsRef    = useRef<TacticEntry[]>([]);
  const saveMsgTimeoutRef = useRef<number | null>(null);
  const draftSaveTimeoutRef = useRef<number | null>(null);
  // Draw-preview origin – tracks start + live endpoint during draw (no React state).
  // Null when not drawing. Enables zero-React-re-render draw preview (same pattern
  // as element dragging).
  const drawOrigin            = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const drawPreviewPathRef    = useRef<SVGPathElement | null>(null);
  const drawPreviewEllipseRef = useRef<SVGEllipseElement | null>(null);

  const registerElRef     = useCallback((id: string, el: SVGGElement | null) => {
    if (el) elDomRefs.current.set(id, el); else elDomRefs.current.delete(id);
  }, []);
  const registerOppRef    = useCallback((id: string, el: HTMLElement | null) => {
    if (el) oppDomRefs.current.set(id, el); else oppDomRefs.current.delete(id);
  }, []);
  const registerPlayerRef = useCallback((id: number, el: HTMLElement | null) => {
    if (el) playerDomRefs.current.set(id, el); else playerDomRefs.current.delete(id);
  }, []);
  const registerPreviewPathRef = useCallback((el: SVGPathElement | null) => {
    drawPreviewPathRef.current = el;
  }, []);
  const registerPreviewEllipseRef = useCallback((el: SVGEllipseElement | null) => {
    drawPreviewEllipseRef.current = el;
  }, []);

  const clearSaveMsgTimeout = useCallback(() => {
    if (saveMsgTimeoutRef.current !== null) {
      window.clearTimeout(saveMsgTimeoutRef.current);
      saveMsgTimeoutRef.current = null;
    }
  }, []);

  const showTransientSaveMsg = useCallback((message: { ok: boolean; text: string } | null, duration = SAVE_MSG_TIMEOUT_MS) => {
    clearSaveMsgTimeout();
    setSaveMsg(message);
    if (message && duration > 0) {
      saveMsgTimeoutRef.current = window.setTimeout(() => {
        setSaveMsg(null);
        saveMsgTimeoutRef.current = null;
      }, duration);
    }
  }, [clearSaveMsgTimeout]);

  // ── Undo / Redo – snapshot current tactics before any mutation ──────────────────
  const pushUndo = useCallback(() => {
    undoStack.current.push(tacticsRef.current);
    if (undoStack.current.length > 50) undoStack.current.shift();
    setCanUndo(true);
    // Every new action invalidates the redo history
    redoStack.current = [];
    setCanRedo(false);
  }, []);

  // ── Derived: active tactic ────────────────────────────────────────────────
  const activeTactic = tactics.find(t => t.id === activeTacticId) ?? tactics[0];
  // Handle drags use imperative DOM mutations (zero React re-renders), so no
  // liveEl state override is needed here. Values are committed once on mouseup.
  const elements  = activeTactic?.elements  ?? [];
  const opponents = activeTactic?.opponents ?? [];
  const selectedDrawElement = selectedId
    ? elements.find(el => el.id === selectedId) ?? null
    : null;

  // ── Pitch layout helpers ──────────────────────────────────────────────────
  //
  // Full pitch:  1920×1357  landscape  pitchAX = w/h of SVG pixels so handles are circular
  // Half pitch:  1357×960   landscape  pitchAX = h/w of SVG pixels for the half-field asset
  const pitchAspect = fullPitch ? '1920 / 1357' : '1357 / 960';
  const pitchAX     = fullPitch ? (1357 / 1920) : (960 / 1357);
  // Keep in a ref so the drag move handler can read it without being a dep
  const pitchAXRef  = useRef(pitchAX);
  pitchAXRef.current = pitchAX;
  tacticsRef.current  = tactics; // keep in sync for undo snapshots

  const playerScreenPos = (px: number, py: number) =>
    fullPitch
      ? { sx: 50 + py * 0.5, sy: 100 - px }
      : { sx: px, sy: py };

  const playerPositionOverrides: PlayerPositionOverride[] = activeTactic?.playerPositions ?? [];

  const ownPlayers = (formation?.formationData?.players ?? []).map(p => {
    const base     = playerScreenPos(p.x, p.y);
    const override = playerPositionOverrides.find(pp => pp.id === p.id);
    return { ...p, sx: override?.sx ?? base.sx, sy: override?.sy ?? base.sy };
  });

  const formationName = formation?.name ?? '';
  const formationCode = formation?.formationData?.code;
  const notes         = formation?.formationData?.notes;

  // Keep a ref in sync so handleToggleFullPitch can read the current value
  // without a stale closure.
  const fullPitchRef = useRef(fullPitch);
  fullPitchRef.current = fullPitch;

  // ── Toggle pitch mode ─────────────────────────────────────────────────────
  // Transforms all coordinates via fullToHalfPt / halfToFullPt.
  // Values outside [0,100] are kept as-is; the SVG viewBox clips them.
  const handleToggleFullPitch = useCallback(
    (valueOrUpdater: boolean | ((prev: boolean) => boolean)) => {
      const prev = fullPitchRef.current;
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      if (next === prev) return;

      const fn = next ? halfToFullPt : fullToHalfPt;

      setTactics(cur => cur.map(t => ({
        ...t,
        elements:        t.elements.map(el => transformEl(el, fn)),
        opponents:       t.opponents.map(o  => transformOpp(o, fn)),
        playerPositions: (t.playerPositions ?? []).map(pp => transformPlayerPos(pp, fn)),
      })));

      // Cancel any in-flight drag
      elDragOrigin.current        = null;
      oppDragOrigin.current       = null;
      ownPlayerDragOrigin.current = null;
      drawOrigin.current = null;
      if (drawPreviewPathRef.current)    drawPreviewPathRef.current.style.visibility    = 'hidden';
      if (drawPreviewEllipseRef.current) drawPreviewEllipseRef.current.style.visibility = 'hidden';
      setElDrag(null); setOppDrag(null); setOwnPlayerDrag(null);

      setFullPitch(next);
    },
    [], // intentionally empty – uses refs and stable state setters
  );

  // ── Marker id helper ──────────────────────────────────────────────────────
  const markerId = (hex: string, kind: 'solid' | 'dashed') =>
    makeMarkerId(uid, hex, kind);

  // ── SVG cursor ────────────────────────────────────────────────────────────
  const svgCursor = elDrag || oppDrag ? 'grabbing' : 'crosshair';

  // ── Mutation helpers – always operate on the active tactic ────────────────
  const updateActiveElements = useCallback(
    (fn: (prev: DrawElement[]) => DrawElement[]) => {
      setIsDirty(true);
      setTactics(prev =>
        prev.map(t => t.id !== activeTacticId ? t : { ...t, elements: fn(t.elements) }));
    },
    [activeTacticId],
  );

  const updateActiveOpponents = useCallback(
    (fn: (prev: OpponentToken[]) => OpponentToken[]) => {
      setIsDirty(true);
      setTactics(prev =>
        prev.map(t => t.id !== activeTacticId ? t : { ...t, opponents: fn(t.opponents) }));
    },
    [activeTacticId],
  );

  const updateActivePlayerPositions = useCallback(
    (fn: (prev: PlayerPositionOverride[]) => PlayerPositionOverride[]) => {
      setIsDirty(true);
      setTactics(prev =>
        prev.map(t => t.id !== activeTacticId ? t : { ...t, playerPositions: fn(t.playerPositions ?? []) }));
    },
    [activeTacticId],
  );

  const setColor = useCallback((nextColor: string) => {
    if (selectedDrawElement && selectedDrawElement.color !== nextColor) {
      pushUndo();
      updateActiveElements(prev => prev.map(el =>
        el.id === selectedDrawElement.id ? { ...el, color: nextColor } : el));
    }
    setColorState(nextColor);
  }, [selectedDrawElement, pushUndo, updateActiveElements]);

  const handleResetPlayerPositions = useCallback(() => {
    pushUndo();
    // Clear imperative inline styles set during drag so MUI's CSS class (with
    // base positions) can take effect on the next React render.
    playerDomRefs.current.forEach(el => { el.style.left = ''; el.style.top = ''; });
    updateActivePlayerPositions(() => []);
  }, [pushUndo, updateActivePlayerPositions]);

  // ── Mutation helpers – always operate on the active tactic ─────────────────────
  useEffect(() => {
    if (!open) return;
    const fd  = formation?.formationData as any;
    const arr = fd?.tacticsBoardDataArr as TacticEntry[] | undefined;
    const old = fd?.tacticsBoardData   as TacticsBoardData | undefined;

    let loaded: TacticEntry[];
    if (Array.isArray(arr) && arr.length > 0) {
      loaded = arr;
    } else if (old) {
      loaded = [{
        id: 'tactic-1', name: 'Standard',
        elements: old.elements ?? [], opponents: old.opponents ?? [],
      }];
    } else {
      loaded = [{ id: 'tactic-1', name: 'Standard', elements: [], opponents: [] }];
    }

    let nextTactics = loaded;
    let nextActiveTacticId = loaded[0].id;
    let nextFullPitch = true;
    let restoredLocalDraft = false;

    if (formation?.id) {
      const localDraft = readLocalDraft(formation.id);
      if (localDraft) {
        const localUpdatedAt = Date.parse(localDraft.updatedAt);
        const serverUpdatedAt = getLatestSavedAt(loaded);
        const shouldRestore = Number.isFinite(localUpdatedAt)
          && (serverUpdatedAt === null || localUpdatedAt >= serverUpdatedAt);

        if (shouldRestore && localDraft.tactics.length > 0) {
          nextTactics = localDraft.tactics;
          nextActiveTacticId = nextTactics.some(t => t.id === localDraft.activeTacticId)
            ? localDraft.activeTacticId
            : nextTactics[0].id;
          nextFullPitch = localDraft.fullPitch;
          restoredLocalDraft = true;
        } else if (!shouldRestore) {
          clearLocalDraft(formation.id);
        }
      }
    }

    setTactics(nextTactics);
    setActiveTacticId(nextActiveTacticId);
    setFullPitch(nextFullPitch);
    drawOrigin.current = null;
    setElDrag(null);  setOppDrag(null); setOwnPlayerDrag(null); setRenamingId(null);
    elDragOrigin.current = null; oppDragOrigin.current = null; ownPlayerDragOrigin.current = null;
    setIsDirty(restoredLocalDraft); setSelectedId(null);
    undoStack.current = []; setCanUndo(false);
    redoStack.current = []; setCanRedo(false);

    if (restoredLocalDraft) {
      showTransientSaveMsg({ ok: true, text: 'Lokaler Entwurf wiederhergestellt' }, 5000);
    } else {
      showTransientSaveMsg(null, 0);
    }
  }, [open, formation?.id, showTransientSaveMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !formation?.id || !isDirty) return;

    const activeId = tactics.some(t => t.id === activeTacticId)
      ? activeTacticId
      : (tactics[0]?.id ?? '');

    const draft: LocalTacticsBoardDraft = {
      version: LOCAL_DRAFT_VERSION,
      formationId: formation.id,
      updatedAt: new Date().toISOString(),
      tactics,
      activeTacticId: activeId,
      fullPitch,
    };

    if (draftSaveTimeoutRef.current !== null) {
      window.clearTimeout(draftSaveTimeoutRef.current);
    }

    draftSaveTimeoutRef.current = window.setTimeout(() => {
      writeLocalDraft(draft);
      draftSaveTimeoutRef.current = null;
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => {
      if (draftSaveTimeoutRef.current !== null) {
        window.clearTimeout(draftSaveTimeoutRef.current);
        draftSaveTimeoutRef.current = null;
      }
    };
  }, [open, formation?.id, tactics, activeTacticId, fullPitch, isDirty]);

  useEffect(() => {
    if (!open || !isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [open, isDirty]);

  useEffect(() => () => {
    clearSaveMsgTimeout();
    if (draftSaveTimeoutRef.current !== null) {
      window.clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = null;
    }
  }, [clearSaveMsgTimeout]);

  useEffect(() => {
    if (!selectedDrawElement || selectedDrawElement.color === color) return;
    setColorState(selectedDrawElement.color);
  }, [selectedDrawElement, color]);

  // ── Delete selected element / opponent ───────────────────────────────────
  // Defined here (before the keyboard effect) to avoid TDZ reference error.
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    pushUndo();
    if ((activeTactic?.opponents ?? []).some(o => o.id === selectedId)) {
      updateActiveOpponents(prev => prev.filter(o => o.id !== selectedId));
    } else {
      updateActiveElements(prev => prev.filter(el => el.id !== selectedId));
    }
    setSelectedId(null);
  }, [selectedId, activeTactic, pushUndo, updateActiveOpponents, updateActiveElements]);

  // ── Keyboard shortcut: Delete / Backspace removes selected element ─────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      handleDeleteSelected();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleDeleteSelected]);

  // ── Browser fullscreen ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsBrowserFS(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  // ── Add opponent ──────────────────────────────────────────────────────────
  const handleAddOpponent = useCallback(() => {
    pushUndo();
    updateActiveOpponents(prev => {
      const n          = prev.length;
      const col        = n % 4;
      const row        = Math.floor(n / 4);
      const nextNumber = n === 0 ? 1 : Math.max(...prev.map(o => o.number)) + 1;
      return [...prev, {
        id: `opp-${Date.now()}-${Math.random()}`,
        x: 5  + col       * 10,
        y: 15 + (row % 5) * 16,
        number: nextNumber,
      }];
    });
  }, [pushUndo, updateActiveOpponents]);

  // ── Opponent edit ─────────────────────────────────────────────────────────
  const handleOppDblClick = useCallback((id: string) => {
    setEditingOppId(id);
  }, []);

  const handleOppEditSave = useCallback((id: string, number: number, name: string) => {
    pushUndo();
    updateActiveOpponents(prev => prev.map(o => o.id !== id ? o : { ...o, number, name: name || undefined }));
    setEditingOppId(null);
  }, [pushUndo, updateActiveOpponents]);

  const handleOppEditClose = useCallback(() => {
    setEditingOppId(null);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!formation) return;
    setSaving(true);
    showTransientSaveMsg(null, 0);
    try {
      const now          = new Date().toISOString();
      const boardDataArr = tactics.map(t => ({ ...t, savedAt: now }));
      const updatedFormationData = {
        ...formation.formationData,
        tacticsBoardDataArr: boardDataArr,
      };
      const resp = await apiJson<{ formation: Formation }>(`/formation/${formation.id}/edit`, {
        method: 'POST',
        body: { name: formationName, formationData: updatedFormationData },
      });
      setTactics(boardDataArr);
      clearLocalDraft(formation.id);
      showTransientSaveMsg({ ok: true, text: 'Taktik gespeichert ✓' });
      setIsDirty(false);
      if (resp?.formation) onBoardSaved?.(resp.formation);
    } catch {
      showTransientSaveMsg({ ok: false, text: 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  }, [formation, tactics, formationName, onBoardSaved, showTransientSaveMsg]);

  // ── SVG draw start ────────────────────────────────────────────────────────
  const handleSvgDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'pointer') return;
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const src  = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
    const x = Math.max(0, Math.min(100, ((src.clientX - rect.left) / rect.width)  * 100));
    const y = Math.max(0, Math.min(100, ((src.clientY - rect.top)  / rect.height) * 100));
    drawOrigin.current = { x1: x, y1: y, x2: x, y2: y };
    // Initialise preview element imperatively – zero React re-renders during draw
    if (tool === 'arrow' || tool === 'run') {
      const pathEl = drawPreviewPathRef.current;
      if (pathEl) {
        pathEl.setAttribute('d', '');
        pathEl.setAttribute('stroke', color);
        pathEl.setAttribute('stroke-dasharray', tool === 'run' ? '2.5 1.8' : '');
        pathEl.setAttribute('marker-end', `url(#${makeMarkerId(uid, color, tool === 'run' ? 'dashed' : 'solid')})`);
        pathEl.style.visibility = 'visible';
      }
    } else if (tool === 'zone') {
      const ellEl = drawPreviewEllipseRef.current;
      if (ellEl) {
        ellEl.setAttribute('cx', String(x));
        ellEl.setAttribute('cy', String(y));
        ellEl.setAttribute('rx', '0');
        ellEl.setAttribute('ry', '0');
        ellEl.setAttribute('stroke', color);
        ellEl.setAttribute('fill', `${color}1a`);
        ellEl.style.visibility = 'visible';
      }
    }
  }, [tool, color, uid]);

  // ── SVG move ──────────────────────────────────────────────────────────────────
  // Drag branches use ZERO React setState calls – only imperative DOM mutations.
  // This makes dragging 60 fps regardless of component tree size.
  // Values committed to tactics state once in handleSvgUp.
  const handleSvgMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const src = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
    const cx  = src.clientX;
    const cy  = src.clientY;

    const origin_own = ownPlayerDragOrigin.current;
    if (origin_own) {
      const r = origin_own.svgRect;
      const px = Math.max(1, Math.min(99, origin_own.sx + ((cx - r.left) / r.width  * 100 - origin_own.mouseX)));
      const py = Math.max(1, Math.min(99, origin_own.sy + ((cy - r.top)  / r.height * 100 - origin_own.mouseY)));
      origin_own.liveDx = px - origin_own.sx;
      origin_own.liveDy = py - origin_own.sy;
      if (!origin_own.hasMoved && (Math.abs(origin_own.liveDx) > 0.5 || Math.abs(origin_own.liveDy) > 0.5))
        origin_own.hasMoved = true;
      if (origin_own.domEl) {
        origin_own.domEl.style.left = `${px}%`;
        origin_own.domEl.style.top  = `${py}%`;
      }
      return;
    }

    const origin_opp = oppDragOrigin.current;
    if (origin_opp) {
      const r = origin_opp.svgRect;
      const nx = Math.max(2, Math.min(98, origin_opp.x + ((cx - r.left) / r.width  * 100 - origin_opp.mouseX)));
      const ny = Math.max(1, Math.min(99, origin_opp.y + ((cy - r.top)  / r.height * 100 - origin_opp.mouseY)));
      origin_opp.liveDx = nx - origin_opp.x;
      origin_opp.liveDy = ny - origin_opp.y;
      if (!origin_opp.hasMoved && (Math.abs(origin_opp.liveDx) > 0.5 || Math.abs(origin_opp.liveDy) > 0.5))
        origin_opp.hasMoved = true;
      if (origin_opp.domEl) {
        origin_opp.domEl.style.left = `${nx}%`;
        origin_opp.domEl.style.top  = `${ny}%`;
      }
      return;
    }

    const origin_el = elDragOrigin.current;
    if (origin_el) {
      const r  = origin_el.svgRect;
      const px = (cx - r.left) / r.width  * 100;
      const py = (cy - r.top)  / r.height * 100;
      const dx = px - origin_el.mouseX;
      const dy = py - origin_el.mouseY;
      const init = origin_el.el;

      // 'move' drag: update SVG attributes directly – same zero-React-state strategy as
      // handle/resize drags and player/opponent drags. Avoids CSS transforms on SVG elements
      // which can cause coordinate drift at higher speeds in some browser/GPU combinations.
      if (origin_el.mode === 'move') {
        origin_el.liveX = dx;
        origin_el.liveY = dy;
        if (!origin_el.hasMoved && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) origin_el.hasMoved = true;
        if (init.kind === 'arrow' || init.kind === 'run') {
          const x1 = Math.max(0, Math.min(100, (init as FieldArrow).x1 + dx));
          const y1 = Math.max(0, Math.min(100, (init as FieldArrow).y1 + dy));
          const x2 = Math.max(0, Math.min(100, (init as FieldArrow).x2 + dx));
          const y2 = Math.max(0, Math.min(100, (init as FieldArrow).y2 + dy));
          const vis = clipLine(x1, y1, x2, y2);
          if (origin_el.domVisualPath)
            origin_el.domVisualPath.setAttribute('d', vis ? arrowPath(vis.x1, vis.y1, vis.x2, vis.y2) : '');
          if (origin_el.domHitPath)
            origin_el.domHitPath.setAttribute('d', arrowPath(x1, y1, x2, y2));
          if (origin_el.domStartHandle)
            origin_el.domStartHandle.setAttribute('transform', `translate(${x1}, ${y1})`);
          if (origin_el.domEndHandle)
            origin_el.domEndHandle.setAttribute('transform', `translate(${x2}, ${y2})`);
          // Badge follows midpoint of arrow
          const bx = (x1 + x2) / 2; const by = (y1 + y2) / 2;
          if (origin_el.domBadgeEllipse) { origin_el.domBadgeEllipse.setAttribute('cx', String(bx)); origin_el.domBadgeEllipse.setAttribute('cy', String(by)); }
          if (origin_el.domBadgeText)    { origin_el.domBadgeText.setAttribute('x',  String(bx)); origin_el.domBadgeText.setAttribute('y',  String(by)); }
        } else if (init.kind === 'zone') {
          const cx = Math.max(3, Math.min(97, (init as FieldZone).cx + dx));
          const cy = Math.max(3, Math.min(97, (init as FieldZone).cy + dy));
          if (origin_el.domBodyEllipse) {
            origin_el.domBodyEllipse.setAttribute('cx', String(cx));
            origin_el.domBodyEllipse.setAttribute('cy', String(cy));
          }
          if (origin_el.domResizeHandle) {
            const rx = (init as FieldZone).r * pitchAXRef.current;
            origin_el.domResizeHandle.setAttribute('transform', `translate(${cx + rx}, ${cy})`);
          }
          // Badge follows zone centre
          if (origin_el.domBadgeEllipse) { origin_el.domBadgeEllipse.setAttribute('cx', String(cx)); origin_el.domBadgeEllipse.setAttribute('cy', String(cy)); }
          if (origin_el.domBadgeText)    { origin_el.domBadgeText.setAttribute('x',  String(cx)); origin_el.domBadgeText.setAttribute('y',  String(cy)); }
        }
      } else {
        // Handle drags (start/end/resize): update SVG DOM directly – zero React re-renders.
        // Same strategy as player/opponent drags: imperative mutations every frame,
        // final geometry committed to React state once on mouseup.
        let newEl: DrawElement | null = null;

        if (origin_el.mode === 'start' && (init.kind === 'arrow' || init.kind === 'run')) {
          const x1 = Math.max(0, Math.min(100, px));
          const y1 = Math.max(0, Math.min(100, py));
          newEl = { ...init, x1, y1 };
          // Update visual (clipped) and hit paths + start handle position
          const fullPath = arrowPath(x1, y1, init.x2, init.y2);
          if (origin_el.domHitPath) origin_el.domHitPath.setAttribute('d', fullPath);
          const vis = clipLine(x1, y1, init.x2, init.y2);
          if (origin_el.domVisualPath) {
            origin_el.domVisualPath.setAttribute('d', vis ? arrowPath(vis.x1, vis.y1, vis.x2, vis.y2) : '');
          }
          if (origin_el.domStartHandle) origin_el.domStartHandle.setAttribute('transform', `translate(${x1}, ${y1})`);
          // Badge follows midpoint
          { const bx = (x1 + init.x2) / 2; const by = (y1 + init.y2) / 2;
            if (origin_el.domBadgeEllipse) { origin_el.domBadgeEllipse.setAttribute('cx', String(bx)); origin_el.domBadgeEllipse.setAttribute('cy', String(by)); }
            if (origin_el.domBadgeText)    { origin_el.domBadgeText.setAttribute('x',  String(bx)); origin_el.domBadgeText.setAttribute('y',  String(by)); } }

        } else if (origin_el.mode === 'end' && (init.kind === 'arrow' || init.kind === 'run')) {
          const x2 = Math.max(0, Math.min(100, px));
          const y2 = Math.max(0, Math.min(100, py));
          newEl = { ...init, x2, y2 };
          // Update visual (clipped) and hit paths + end handle position
          const fullPath = arrowPath(init.x1, init.y1, x2, y2);
          if (origin_el.domHitPath) origin_el.domHitPath.setAttribute('d', fullPath);
          const vis = clipLine(init.x1, init.y1, x2, y2);
          if (origin_el.domVisualPath) {
            origin_el.domVisualPath.setAttribute('d', vis ? arrowPath(vis.x1, vis.y1, vis.x2, vis.y2) : '');
          }
          if (origin_el.domEndHandle) origin_el.domEndHandle.setAttribute('transform', `translate(${x2}, ${y2})`);
          // Badge follows midpoint
          { const bx = (init.x1 + x2) / 2; const by = (init.y1 + y2) / 2;
            if (origin_el.domBadgeEllipse) { origin_el.domBadgeEllipse.setAttribute('cx', String(bx)); origin_el.domBadgeEllipse.setAttribute('cy', String(by)); }
            if (origin_el.domBadgeText)    { origin_el.domBadgeText.setAttribute('x',  String(bx)); origin_el.domBadgeText.setAttribute('y',  String(by)); } }

        } else if (origin_el.mode === 'resize' && init.kind === 'zone') {
          const newR = Math.max(3, Math.min(40, Math.hypot(px - init.cx, py - init.cy)));
          newEl = { ...init, r: newR };
          // Update ellipse size + resize handle position
          const rx = newR * pitchAXRef.current;
          const ry = newR;
          if (origin_el.domBodyEllipse) {
            origin_el.domBodyEllipse.setAttribute('rx', String(rx));
            origin_el.domBodyEllipse.setAttribute('ry', String(ry));
          }
          const resizeX = init.cx + rx;
          if (origin_el.domResizeHandle) {
            origin_el.domResizeHandle.setAttribute('transform', `translate(${resizeX}, ${init.cy})`);
          }
        }

        if (newEl) origin_el.liveElData = newEl;
        if (!origin_el.hasMoved && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) origin_el.hasMoved = true;
      }
      return;
    }

    if (!drawOrigin.current || tool === 'pointer') return;
    if (!svgRef.current) return;
    const svgR = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((cx - svgR.left) / svgR.width)  * 100));
    const y = Math.max(0, Math.min(100, ((cy - svgR.top)  / svgR.height) * 100));
    drawOrigin.current.x2 = x;
    drawOrigin.current.y2 = y;
    if (tool === 'arrow' || tool === 'run') {
      const vis = clipLine(drawOrigin.current.x1, drawOrigin.current.y1, x, y);
      drawPreviewPathRef.current?.setAttribute('d',
        vis ? arrowPath(vis.x1, vis.y1, vis.x2, vis.y2) : '');
    } else if (tool === 'zone') {
      const zR = Math.hypot(x - drawOrigin.current.x1, y - drawOrigin.current.y1);
      const ellEl = drawPreviewEllipseRef.current;
      if (ellEl) {
        ellEl.setAttribute('rx', String(zR * pitchAXRef.current));
        ellEl.setAttribute('ry', String(zR));
      }
    }
  }, [tool]);

  // ── SVG pointer up ────────────────────────────────────────────────────────
  // Commits DOM position to tactics state (one setTactics call per drag).
  const handleSvgUp = useCallback((keepSelection = false) => {
    if (ownPlayerDragOrigin.current) {
      const o = ownPlayerDragOrigin.current;
      if (o.hasMoved) {
        const id = o.id;
        const sx = Math.max(1, Math.min(99, o.sx + o.liveDx));
        const sy = Math.max(1, Math.min(99, o.sy + o.liveDy));
        pushUndo();
        updateActivePlayerPositions(prev => {
          const exists = prev.some(pp => pp.id === id);
          return exists
            ? prev.map(pp => pp.id === id ? { ...pp, sx, sy } : pp)
            : [...prev, { id, sx, sy }];
        });
      }
      // Clear drag-time inline styles so React/MUI CSS class takes over on re-render.
      // Without this, style.left / style.top override the MUI class after reset.
      if (o.domEl) { o.domEl.style.left = ''; o.domEl.style.top = ''; }
      ownPlayerDragOrigin.current = null;
      setOwnPlayerDrag(null);
      return;
    }
    if (oppDragOrigin.current) {
      const o = oppDragOrigin.current;
      if (!o.hasMoved) {
        const oppId = o.id;
        if (!keepSelection) setSelectedId(prev => prev === oppId ? null : oppId);
      } else {
        const id = o.id;
        const x  = Math.max(2, Math.min(98, o.x + o.liveDx));
        const y  = Math.max(1, Math.min(99, o.y + o.liveDy));
        pushUndo();
        updateActiveOpponents(prev => prev.map(opp => opp.id !== id ? opp : { ...opp, x, y }));
        if (!keepSelection) setSelectedId(null);
      }
      if (o.domEl) { o.domEl.style.left = ''; o.domEl.style.top = ''; }
      oppDragOrigin.current = null;
      setOppDrag(null);
      return;
    }
    if (elDragOrigin.current) {
      const o = elDragOrigin.current;
      if (!o.hasMoved) {
        const elId = o.id;
        if (!keepSelection) setSelectedId(prev => prev === elId ? null : elId);
      } else {
        pushUndo();
        if (o.mode === 'move') {
          const id = o.id; const init = o.el; const dx = o.liveX; const dy = o.liveY;
          if (init.kind === 'arrow' || init.kind === 'run') {
            const arr = init as FieldArrow;
            updateActiveElements(prev => prev.map(el => el.id !== id ? el : { ...init,
              x1: Math.max(0, Math.min(100, arr.x1 + dx)),
              y1: Math.max(0, Math.min(100, arr.y1 + dy)),
              x2: Math.max(0, Math.min(100, arr.x2 + dx)),
              y2: Math.max(0, Math.min(100, arr.y2 + dy)),
            }));
          } else {
            const zone = init as FieldZone;
            updateActiveElements(prev => prev.map(el => el.id !== id ? el : { ...init,
              cx: Math.max(3, Math.min(97, zone.cx + dx)),
              cy: Math.max(3, Math.min(97, zone.cy + dy)),
            } as FieldZone));
          }
        } else if (o.liveElData) {
          const live = o.liveElData;
          updateActiveElements(prev => prev.map(el => el.id !== live.id ? el : live));
        }
        if (!keepSelection) setSelectedId(null);
      }
      elDragOrigin.current = null;
      setElDrag(null);
      return;
    }

    // Click on empty space or finished drawing → deselect (but not on mouse-leave)
    if (!keepSelection) setSelectedId(null);

    // Hide preview elements and commit draw geometry
    if (drawPreviewPathRef.current)    drawPreviewPathRef.current.style.visibility    = 'hidden';
    if (drawPreviewEllipseRef.current) drawPreviewEllipseRef.current.style.visibility = 'hidden';
    const origin = drawOrigin.current;
    drawOrigin.current = null;
    if (!origin) return;

    const dist = Math.hypot(origin.x2 - origin.x1, origin.y2 - origin.y1);
    if (dist < 2) return;

    const id = `el-${Date.now()}-${Math.random()}`;
    pushUndo();
    if (tool === 'arrow' || tool === 'run') {
      updateActiveElements(prev => [...prev, {
        id, kind: tool,
        x1: origin.x1, y1: origin.y1,
        x2: origin.x2, y2: origin.y2,
        color,
      }]);
    } else if (tool === 'zone') {
      updateActiveElements(prev => [...prev, {
        id, kind: 'zone',
        cx: origin.x1, cy: origin.y1,
        r: Math.min(dist, 35),
        color,
      }]);
    }
  }, [tool, color, pushUndo, updateActiveElements, updateActiveOpponents, updateActivePlayerPositions]);

  // ── Element drag start ────────────────────────────────────────────────────
  const handleElDown = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    id: string,
    mode: 'move' | 'start' | 'end' | 'resize' = 'move',
  ) => {
    e.stopPropagation();
    if (!svgRef.current) return;
    const rect  = svgRef.current.getBoundingClientRect();
    const src   = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
    const mouseX = (src.clientX - rect.left) / rect.width  * 100;
    const mouseY = (src.clientY - rect.top)  / rect.height * 100;
    const el = (activeTactic?.elements ?? []).find(el => el.id === id);
    if (!el) return;
    const domGroup     = elDomRefs.current.get(id) ?? null;
    // Query child elements once at drag-start for imperative updates during drag
    const domVisualPath   = domGroup?.querySelector<SVGPathElement>('[data-role="visual"]')    ?? null;
    const domHitPath      = domGroup?.querySelector<SVGPathElement>('[data-role="hit"]')        ?? null;
    const domStartHandle  = domGroup?.querySelector<SVGGElement>('[data-role="start-handle"]')  ?? null;
    const domEndHandle    = domGroup?.querySelector<SVGGElement>('[data-role="end-handle"]')    ?? null;
    const domBodyEllipse  = domGroup?.querySelector<SVGEllipseElement>('[data-role="body"]')    ?? null;
    const domResizeHandle = domGroup?.querySelector<SVGGElement>('[data-role="resize-handle"]') ?? null;
    const domBadgeEllipse = domGroup?.querySelector<SVGEllipseElement>('[data-role="badge-ellipse"]') ?? null;
    const domBadgeText    = domGroup?.querySelector<SVGTextElement>('[data-role="badge-text"]')       ?? null;
    elDragOrigin.current = {
      id, mode, mouseX, mouseY, el, hasMoved: false,
      svgRect: rect, domGroup, liveX: 0, liveY: 0,
      domVisualPath, domHitPath, domStartHandle, domEndHandle, domBodyEllipse, domResizeHandle,
      domBadgeEllipse, domBadgeText,
      liveElData: null,
    };
    setElDrag({ id, mode, startX: mouseX, startY: mouseY, hasMoved: false });
  }, [activeTactic]);

  // ── Opponent drag start ───────────────────────────────────────────────────
  const handleOppDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    if (!svgRef.current) return;
    const opp = (activeTactic?.opponents ?? []).find(o => o.id === id);
    if (!opp) return;
    const rect  = svgRef.current.getBoundingClientRect();
    const src   = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
    const mouseX = (src.clientX - rect.left) / rect.width  * 100;
    const mouseY = (src.clientY - rect.top)  / rect.height * 100;
    const domEl  = oppDomRefs.current.get(id) ?? null;
    oppDragOrigin.current = { id, mouseX, mouseY, x: opp.x, y: opp.y, hasMoved: false,
      svgRect: rect, domEl, liveDx: 0, liveDy: 0 };
    setOppDrag({ id, startX: mouseX, startY: mouseY, hasMoved: false });
  }, [activeTactic]);

  // ── Own player drag start ─────────────────────────────────────────────────
  const handleOwnPlayerDown = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    id: number,
    sx: number,
    sy: number,
  ) => {
    e.stopPropagation();
    if (!svgRef.current) return;
    const rect  = svgRef.current.getBoundingClientRect();
    const src   = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
    const mouseX = (src.clientX - rect.left) / rect.width  * 100;
    const mouseY = (src.clientY - rect.top)  / rect.height * 100;
    const domEl  = playerDomRefs.current.get(id) ?? null;
    ownPlayerDragOrigin.current = { id, mouseX, mouseY, sx, sy, hasMoved: false,
      svgRect: rect, domEl, liveDx: 0, liveDy: 0 };
    setOwnPlayerDrag({ id, startX: mouseX, startY: mouseY, hasMoved: false });
  }, []);

  // ── Clear / Undo ──────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    pushUndo();
    playerDomRefs.current.forEach(el => { el.style.left = ''; el.style.top = ''; });
    oppDomRefs.current.forEach(el => { el.style.left = ''; el.style.top = ''; });
    updateActiveElements(() => []);
    updateActiveOpponents(() => []);
    updateActivePlayerPositions(() => []);
    setSelectedId(null);
  }, [pushUndo, updateActiveElements, updateActiveOpponents, updateActivePlayerPositions]);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    // Save current state to redo stack before restoring
    redoStack.current.push(tacticsRef.current);
    if (redoStack.current.length > 50) redoStack.current.shift();
    setCanRedo(true);
    const prev = undoStack.current.pop()!;
    if (undoStack.current.length === 0) setCanUndo(false);
    setTactics(prev);
    setIsDirty(true);
    setSelectedId(null);
  }, []);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    // Save current state to undo stack before re-applying
    undoStack.current.push(tacticsRef.current);
    setCanUndo(true);
    const next = redoStack.current.pop()!;
    if (redoStack.current.length === 0) setCanRedo(false);
    setTactics(next);
    setIsDirty(true);
    setSelectedId(null);
  }, []);

  // ── Tactic management ─────────────────────────────────────────────────────
  const handleNewTactic = useCallback(() => {
    const id = `tactic-${Date.now()}`;
    setTactics(prev => [...prev, { id, name: 'Neue Taktik', elements: [], opponents: [] }]);
    setActiveTacticId(id);
    setRenamingId(id);
    setRenameValue('Neue Taktik');
    setIsDirty(true);
  }, []);

  const handleDeleteTactic = useCallback((id: string) => {
    setTactics(prev => {
      if (prev.length <= 1) return prev;
      const idx  = prev.findIndex(t => t.id === id);
      const next = prev.filter(t => t.id !== id);
      setActiveTacticId(current =>
        current === id ? next[Math.max(0, idx - 1)].id : current,
      );
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleLoadPreset = useCallback((preset: TacticPreset) => {
    const id = `tactic-${Date.now()}`;
    const newTactic: TacticEntry = {
      id,
      name: preset.title,
      elements: preset.data.elements ?? [],
      opponents: preset.data.opponents ?? [],
    };
    setTactics(prev => [...prev, newTactic]);
    setActiveTacticId(id);
    setIsDirty(true);
  }, []);

  const confirmRename = useCallback(() => {
    if (renameValue.trim()) {
      setTactics(prev =>
        prev.map(t => t.id !== renamingId ? t : { ...t, name: renameValue.trim() }),
      );
      setIsDirty(true);
    }
    setRenamingId(null);
  }, [renameValue, renamingId]);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    svgRef, containerRef, pitchRef,
    tool, setTool, color, setColor,
    tactics, setTactics,
    activeTacticId, setActiveTacticId,
    renamingId, setRenamingId,
    renameValue, setRenameValue,
    fullPitch, setFullPitch: handleToggleFullPitch as React.Dispatch<React.SetStateAction<boolean>>,
    isBrowserFS,
    showNotes, setShowNotes,
    saving, saveMsg,
    elDrag, oppDrag, ownPlayerDrag,
    elements, opponents, activeTactic,
    pitchAX, pitchAspect, svgCursor, markerId,
    ownPlayers, formationName, formationCode, notes,
    isDirty,
    handleAddOpponent, handleOppDblClick, handleOppEditSave, handleOppEditClose, editingOppId,
    handleSave,
    handleSvgDown, handleSvgMove, handleSvgUp,
    handleSvgLeave: useCallback(() => handleSvgUp(true), [handleSvgUp]),
    handleElDown, handleOppDown, handleOwnPlayerDown,
    handleClear, handleUndo, handleRedo, handleResetPlayerPositions,
    handleNewTactic, handleDeleteTactic, handleLoadPreset, confirmRename,
    toggleFullscreen,
    selectedId, setSelectedId, handleDeleteSelected,
    canUndo, canRedo,
    registerElRef, registerOppRef, registerPlayerRef,
    registerPreviewPathRef, registerPreviewEllipseRef,
  };
}

