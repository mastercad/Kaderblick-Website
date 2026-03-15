// ─── TacticsBoard – main state hook ───────────────────────────────────────────
import { useRef, useState, useCallback, useEffect, useId } from 'react';
import React from 'react';
import { apiJson } from '../../utils/api';
import type { Formation, PlayerData } from '../formation/types';
import {
  Tool, DrawElement, FieldZone, FieldArrow, OpponentToken, TacticEntry, TacticsBoardData,
  DrawPreview, ElDragState, OppDragState, OwnPlayerDragState, PlayerPositionOverride,
} from './types';
import type { TacticPreset } from './types';
import { svgCoords, makeMarkerId } from './utils';
import { PALETTE } from './constants';

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
  mouseX: number;
  mouseY: number;
  el: DrawElement;
  hasMoved: boolean;
}

interface OppDragOrigin {
  id: string;
  mouseX: number;
  mouseY: number;
  x: number;
  y: number;
  hasMoved: boolean;
}

interface OwnPlayerDragOrigin {
  id: number;
  mouseX: number;
  mouseY: number;
  sx: number;
  sy: number;
  hasMoved: boolean;
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

  // Drawing
  preview: DrawPreview | null;
  drawing: boolean;

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
  handleSave: () => Promise<void>;
  handleSvgDown: (e: React.MouseEvent | React.TouchEvent) => void;
  handleSvgMove: (e: React.MouseEvent | React.TouchEvent) => void;
  handleSvgUp: () => void;
  handleElDown: (
    e: React.MouseEvent | React.TouchEvent,
    id: string,
    mode?: 'move' | 'start' | 'end' | 'resize',
  ) => void;
  handleOppDown: (e: React.MouseEvent | React.TouchEvent, id: string) => void;
  handleOwnPlayerDown: (e: React.MouseEvent | React.TouchEvent, id: number, sx: number, sy: number) => void;
  handleClear: () => void;
  handleUndo: () => void;
  handleResetPlayerPositions: () => void;
  handleNewTactic: () => void;
  handleDeleteTactic: (id: string) => void;
  /** Load a tactic preset as a new tab (never overwrites existing work). */
  handleLoadPreset: (preset: TacticPreset) => void;
  confirmRename: () => void;
  toggleFullscreen: () => Promise<void>;
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
  const [color, setColor] = useState(PALETTE[0].value);

  // ── Multi-tactic state ────────────────────────────────────────────────────
  const [tactics, setTactics]               = useState<TacticEntry[]>([]);
  const [activeTacticId, setActiveTacticId] = useState<string>('');
  const [renamingId, setRenamingId]         = useState<string | null>(null);
  const [renameValue, setRenameValue]       = useState('');

  // ── Drawing state ─────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<DrawPreview | null>(null);
  const [drawing, setDrawing] = useState(false);

  // ── UI toggles ────────────────────────────────────────────────────────────
  const [fullPitch, setFullPitch]     = useState(true);
  const [isBrowserFS, setIsBrowserFS] = useState(false);
  const [showNotes, setShowNotes]     = useState(false);

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // ── Drag state (React state: used only for visual feedback / cursor) ─────────
  const [elDrag, setElDrag]               = useState<ElDragState        | null>(null);
  const [oppDrag, setOppDrag]             = useState<OppDragState       | null>(null);
  const [ownPlayerDrag, setOwnPlayerDrag] = useState<OwnPlayerDragState | null>(null);

  // ── Drag origin refs (always current – used in move handler) ──────────────────
  // Storing immutable drag origins in refs instead of depending on stale closure
  // values ensures that fast mouse movements don't cause objects to drift.
  const elDragOrigin       = useRef<ElDragOrigin       | null>(null);
  const oppDragOrigin      = useRef<OppDragOrigin      | null>(null);
  const ownPlayerDragOrigin = useRef<OwnPlayerDragOrigin | null>(null);

  // ── Derived: active tactic ────────────────────────────────────────────────
  const activeTactic = tactics.find(t => t.id === activeTacticId) ?? tactics[0];
  const elements  = activeTactic?.elements  ?? [];
  const opponents = activeTactic?.opponents ?? [];

  // ── Pitch layout helpers ──────────────────────────────────────────────────
  //
  // Full pitch:  1920×1357  landscape  pitchAX = w/h of SVG pixels so handles are circular
  // Half pitch:  960×1357   portrait   pitchAX = h/w of SVG pixels (denominator flipped
  //                                    because the container is taller than wide)
  const pitchAspect = fullPitch ? '1920 / 1357' : '1357 / 960';
  const pitchAX     = fullPitch ? (1357 / 1920)  : (960  / 1357);

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
      setElDrag(null); setOppDrag(null); setOwnPlayerDrag(null);
      setDrawing(false); setPreview(null);

      setFullPitch(next);
    },
    [], // intentionally empty – uses refs and stable state setters
  );

  // ── Marker id helper ──────────────────────────────────────────────────────
  const markerId = (hex: string, kind: 'solid' | 'dashed') =>
    makeMarkerId(uid, hex, kind);

  // ── SVG cursor ────────────────────────────────────────────────────────────
  const svgCursor = elDrag || oppDrag
    ? 'grabbing'
    : tool === 'pointer' ? 'default' : 'crosshair';

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

  const handleResetPlayerPositions = useCallback(() => {
    updateActivePlayerPositions(() => []);
  }, [updateActivePlayerPositions]);

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
    setTactics(loaded);
    setActiveTacticId(loaded[0].id);
    setPreview(null); setDrawing(false);
    setElDrag(null);  setOppDrag(null); setOwnPlayerDrag(null); setSaveMsg(null); setRenamingId(null);
    elDragOrigin.current = null; oppDragOrigin.current = null; ownPlayerDragOrigin.current = null;
    setIsDirty(false);
  }, [open, formation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setTool('pointer');
  }, [updateActiveOpponents]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!formation) return;
    setSaving(true); setSaveMsg(null);
    try {
      const now          = new Date().toISOString();
      const boardDataArr = tactics.map(t =>
        t.id === activeTacticId ? { ...t, savedAt: now } : t,
      );
      const updatedFormationData = {
        ...formation.formationData,
        tacticsBoardDataArr: boardDataArr,
      };
      const resp = await apiJson<{ formation: Formation }>(`/formation/${formation.id}/edit`, {
        method: 'POST',
        body: { name: formationName, formationData: updatedFormationData },
      });
      setSaveMsg({ ok: true, text: 'Taktik gespeichert ✓' });
      setIsDirty(false);
      if (resp?.formation) onBoardSaved?.(resp.formation);
    } catch {
      setSaveMsg({ ok: false, text: 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3500);
    }
  }, [formation, tactics, activeTacticId, formationName, onBoardSaved]);

  // ── SVG draw start ────────────────────────────────────────────────────────
  const handleSvgDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'pointer') return;
    e.preventDefault();
    if (!svgRef.current) return;
    const pt = svgCoords(e, svgRef.current);
    setDrawing(true);
    setPreview({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
  }, [tool]);

  // ── SVG move ──────────────────────────────────────────────────────────────────
  // All drag branches use ABSOLUTE positioning anchored to the drag-origin ref:
  //   newPos = initObjPos + (currentMouse - initMouse)
  // This is stale-closure-proof and drift-free regardless of how fast the mouse
  // moves or how React batches state updates.
  const handleSvgMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!svgRef.current) return;

    const origin_own = ownPlayerDragOrigin.current;
    if (origin_own) {
      e.preventDefault();
      const pt = svgCoords(e, svgRef.current);
      const newSx = Math.max(1, Math.min(99, origin_own.sx + (pt.x - origin_own.mouseX)));
      const newSy = Math.max(1, Math.min(99, origin_own.sy + (pt.y - origin_own.mouseY)));
      updateActivePlayerPositions(prev => prev.map(pp =>
        pp.id !== origin_own.id ? pp : { ...pp, sx: newSx, sy: newSy },
      ));
      if (!origin_own.hasMoved && Math.hypot(newSx - origin_own.sx, newSy - origin_own.sy) > 0.5) {
        origin_own.hasMoved = true;
        setOwnPlayerDrag(prev => prev ? { ...prev, hasMoved: true } : null);
      }
      return;
    }

    const origin_opp = oppDragOrigin.current;
    if (origin_opp) {
      e.preventDefault();
      const pt = svgCoords(e, svgRef.current);
      const newX = Math.max(2,  Math.min(98, origin_opp.x + (pt.x - origin_opp.mouseX)));
      const newY = Math.max(1,  Math.min(99, origin_opp.y + (pt.y - origin_opp.mouseY)));
      updateActiveOpponents(prev => prev.map(o =>
        o.id !== origin_opp.id ? o : { ...o, x: newX, y: newY },
      ));
      if (!origin_opp.hasMoved && Math.hypot(newX - origin_opp.x, newY - origin_opp.y) > 0.5) {
        origin_opp.hasMoved = true;
        setOppDrag(prev => prev ? { ...prev, hasMoved: true } : null);
      }
      return;
    }

    const origin_el = elDragOrigin.current;
    if (origin_el) {
      e.preventDefault();
      const pt = svgCoords(e, svgRef.current);
      const dx = pt.x - origin_el.mouseX;
      const dy = pt.y - origin_el.mouseY;
      updateActiveElements(prev => prev.map(el => {
        if (el.id !== origin_el.id) return el;

        // 'start' / 'end' / 'resize': snap to live cursor position (already absolute)
        if (origin_el.mode === 'start' && (el.kind === 'arrow' || el.kind === 'run')) {
          return { ...el,
            x1: Math.max(0, Math.min(100, pt.x)),
            y1: Math.max(0, Math.min(100, pt.y)),
          };
        }
        if (origin_el.mode === 'end' && (el.kind === 'arrow' || el.kind === 'run')) {
          return { ...el,
            x2: Math.max(0, Math.min(100, pt.x)),
            y2: Math.max(0, Math.min(100, pt.y)),
          };
        }
        if (origin_el.mode === 'resize' && el.kind === 'zone') {
          return { ...el,
            r: Math.max(3, Math.min(40, Math.hypot(pt.x - el.cx, pt.y - el.cy))),
          };
        }

        // 'move': offset from ORIGIN snapshot (not from current state) → drift-free
        const init = origin_el.el;
        if (init.kind === 'arrow' || init.kind === 'run') {
          return { ...el,
            x1: Math.max(0, Math.min(100, (init as FieldArrow).x1 + dx)),
            y1: Math.max(0, Math.min(100, (init as FieldArrow).y1 + dy)),
            x2: Math.max(0, Math.min(100, (init as FieldArrow).x2 + dx)),
            y2: Math.max(0, Math.min(100, (init as FieldArrow).y2 + dy)),
          };
        }
        return { ...el,
          cx: Math.max(3, Math.min(97, (init as FieldZone).cx + dx)),
          cy: Math.max(3, Math.min(97, (init as FieldZone).cy + dy)),
        } as FieldZone;
      }));
      if (!origin_el.hasMoved && Math.hypot(dx, dy) > 0.5) {
        origin_el.hasMoved = true;
        setElDrag(prev => prev ? { ...prev, hasMoved: true } : null);
      }
      return;
    }

    if (!drawing || tool === 'pointer') return;
    e.preventDefault();
    const pt = svgCoords(e, svgRef.current);
    setPreview(prev => prev ? { ...prev, x2: pt.x, y2: pt.y } : null);
  }, [drawing, tool, updateActiveElements, updateActiveOpponents, updateActivePlayerPositions]);

  // ── SVG pointer up ────────────────────────────────────────────────────────
  const handleSvgUp = useCallback(() => {
    if (ownPlayerDragOrigin.current) {
      ownPlayerDragOrigin.current = null;
      setOwnPlayerDrag(null);
      return;
    }
    if (oppDragOrigin.current) {
      if (!oppDragOrigin.current.hasMoved) {
        const id = oppDragOrigin.current.id;
        updateActiveOpponents(prev => prev.filter(o => o.id !== id));
      }
      oppDragOrigin.current = null;
      setOppDrag(null);
      return;
    }
    if (elDragOrigin.current) {
      if (!elDragOrigin.current.hasMoved && tool === 'pointer') {
        const id = elDragOrigin.current.id;
        updateActiveElements(prev => prev.filter(el => el.id !== id));
      }
      elDragOrigin.current = null;
      setElDrag(null);
      return;
    }

    if (!drawing || !preview) { setDrawing(false); return; }
    setDrawing(false);
    const dist = Math.hypot(preview.x2 - preview.x1, preview.y2 - preview.y1);
    if (dist < 2) { setPreview(null); return; }

    const id = `el-${Date.now()}-${Math.random()}`;
    if (tool === 'arrow' || tool === 'run') {
      updateActiveElements(prev => [...prev, {
        id, kind: tool,
        x1: preview.x1, y1: preview.y1,
        x2: preview.x2, y2: preview.y2,
        color,
      }]);
    } else if (tool === 'zone') {
      updateActiveElements(prev => [...prev, {
        id, kind: 'zone',
        cx: preview.x1, cy: preview.y1,
        r: Math.min(dist, 35),
        color,
      }]);
    }
    setPreview(null);
  }, [tool, drawing, preview, color, updateActiveElements, updateActiveOpponents]);

  // ── Element drag start ────────────────────────────────────────────────────
  const handleElDown = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    id: string,
    mode: 'move' | 'start' | 'end' | 'resize' = 'move',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!svgRef.current) return;
    const pt = svgCoords(e, svgRef.current);
    // Find the element snapshot for 'move' origin anchoring
    const el = (activeTactic?.elements ?? []).find(el => el.id === id);
    if (!el) return;
    elDragOrigin.current = { id, mode, mouseX: pt.x, mouseY: pt.y, el, hasMoved: false };
    setElDrag({ id, mode, startX: pt.x, startY: pt.y, hasMoved: false });
  }, [activeTactic]);

  // ── Opponent drag start ───────────────────────────────────────────────────
  const handleOppDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!svgRef.current) return;
    const opp = (activeTactic?.opponents ?? []).find(o => o.id === id);
    if (!opp) return;
    const pt = svgCoords(e, svgRef.current);
    oppDragOrigin.current = { id, mouseX: pt.x, mouseY: pt.y, x: opp.x, y: opp.y, hasMoved: false };
    setOppDrag({ id, startX: pt.x, startY: pt.y, hasMoved: false });
  }, [activeTactic]);

  // ── Own player drag start ─────────────────────────────────────────────────
  const handleOwnPlayerDown = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    id: number,
    sx: number,
    sy: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!svgRef.current) return;
    const pt = svgCoords(e, svgRef.current);
    // Seed playerPositions so the absolute updater always finds an entry
    updateActivePlayerPositions(prev =>
      prev.some(pp => pp.id === id) ? prev : [...prev, { id, sx, sy }],
    );
    ownPlayerDragOrigin.current = { id, mouseX: pt.x, mouseY: pt.y, sx, sy, hasMoved: false };
    setOwnPlayerDrag({ id, startX: pt.x, startY: pt.y, hasMoved: false });
  }, [updateActivePlayerPositions]);

  // ── Clear / Undo ──────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    updateActiveElements(() => []);
    updateActiveOpponents(() => []);
    updateActivePlayerPositions(() => []);
  }, [updateActiveElements, updateActiveOpponents, updateActivePlayerPositions]);

  const handleUndo = useCallback(() => {
    updateActiveElements(prev => prev.slice(0, -1));
  }, [updateActiveElements]);

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
      // If the deleted tactic was active, select the closest remaining one
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
    preview, drawing,
    fullPitch, setFullPitch: handleToggleFullPitch as React.Dispatch<React.SetStateAction<boolean>>,
    isBrowserFS,
    showNotes, setShowNotes,
    saving, saveMsg,
    elDrag, oppDrag, ownPlayerDrag,
    elements, opponents, activeTactic,
    pitchAX, pitchAspect, svgCursor, markerId,
    ownPlayers, formationName, formationCode, notes,
    isDirty,
    handleAddOpponent, handleSave,
    handleSvgDown, handleSvgMove, handleSvgUp,
    handleElDown, handleOppDown, handleOwnPlayerDown,
    handleClear, handleUndo, handleResetPlayerPositions,
    handleNewTactic, handleDeleteTactic, handleLoadPreset, confirmRename,
    toggleFullscreen,
  };
}
