/**
 * TacticsBoardModal – interaktives taktisches Whiteboard
 *
 *   tacticsBoard/types.ts            Alle TypeScript-Typen
 *   tacticsBoard/constants.ts        Farbpalette & Konstanten
 *   tacticsBoard/utils.ts            Reine Hilfsfunktionen (arrowPath, svgCoords …)
 *   tacticsBoard/useTacticsBoard.ts  Zentraler State-Hook (alle Handler & Refs)
 *   tacticsBoard/PitchCanvas.tsx     Spielfeld-Bild + SVG-Zeichenschicht
 *   tacticsBoard/TacticsToolbar.tsx  Werkzeugzeile
 *   tacticsBoard/TacticsBar.tsx      Taktik-Tab-Leiste
 *   tacticsBoard/StatusBar.tsx       Statuszeile
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog, Box, Typography,
  DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
  TextField, InputAdornment, IconButton, CircularProgress, Chip,
  useTheme, Tooltip,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { TeamBriefing } from './tacticsBoard/TeamBriefing';
import { useFabStack }      from '../components/FabStackProvider';
import PortraitHint         from '../components/PortraitHint';
import { useTacticsBoard }  from './tacticsBoard/useTacticsBoard';
import { PitchCanvas }      from './tacticsBoard/PitchCanvas';
import { TacticsToolbar }   from './tacticsBoard/TacticsToolbar';
import { TacticsBar }       from './tacticsBoard/TacticsBar';
import { StatusBar }        from './tacticsBoard/StatusBar';

// Re-export public types so existing imports continue to work
export type {
  TacticsBoardModalProps,
  TacticEntry, TacticsBoardData,
  DrawElement, OpponentToken,
} from './tacticsBoard/types';

import type { TacticsBoardModalProps } from './tacticsBoard/types';

// ─── Component ─────────────────────────────────────────────────────────────────

const TacticsBoardModal: React.FC<TacticsBoardModalProps> = ({
  open, onClose, formation, onBoardSaved,
}) => {
  const board = useTacticsBoard(open, formation, onBoardSaved);
  const fabStack = useFabStack();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const getDialogContainer = useCallback(() => board.containerRef.current ?? document.body, [board.containerRef]);

  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [showStepNumbers, setShowStepNumbers] = useState(false);
  const [tacticToDeleteId, setTacticToDeleteId] = useState<string | null>(null);
  const [fitPitchToHeight, setFitPitchToHeight] = useState(true);
  const [hideFullscreenChrome, setHideFullscreenChrome] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [leftBarOpen, setLeftBarOpen] = useState(true);
  const [rightBarOpen, setRightBarOpen] = useState(false);
  const [topActionsVisible, setTopActionsVisible] = useState(true);
  const forceWidthMode = isMobile && isPortrait;
  const effectiveFitPitchToHeight = fitPitchToHeight && !forceWidthMode;
  const isPresentationMode = hideFullscreenChrome;

  // FAB (Feedback-Button) ausblenden solange das Board offen ist
  useEffect(() => {
    if (open) {
      fabStack?.hideForModal();
      return () => { fabStack?.showAfterModal(); };
    }
  }, [open, fabStack]);

  // Präsentationsmodus beim Schließen zurücksetzen
  useEffect(() => {
    if (!open) {
      setPresentationMode(false);
      setHideFullscreenChrome(false);
    }
  }, [open]);

  useEffect(() => {
    if (presentationMode) {
      board.setSelectedId?.(null);
    }
  }, [board, presentationMode]);

  // Untere Navigation ausblenden wenn das Board offen ist
  useEffect(() => {
    if (open && isMobile) {
      document.body.classList.add('tactics-board-open');
    }
    return () => { document.body.classList.remove('tactics-board-open'); };
  }, [open, isMobile]);

  // Browser-Zurück-Button schließt zuerst das Board (verhält sich wie eine eigene Seite)
  const closedByHistoryRef = useRef(false);
  const isDirtyRef = useRef(board.isDirty);
  isDirtyRef.current = board.isDirty;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    closedByHistoryRef.current = false;
    history.pushState({ tacticsBoardOpen: true }, '');

    const handlePopState = () => {
      if (isDirtyRef.current) {
        // History-Eintrag zurückschieben, damit Zurück weiter greift wenn
        // der Nutzer im Warning-Dialog „Weiter bearbeiten" wählt
        history.pushState({ tacticsBoardOpen: true }, '');
        setShowCloseWarning(true);
      } else {
        closedByHistoryRef.current = true;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Modal wurde per Button geschlossen → unseren History-Eintrag bereinigen
      if (!closedByHistoryRef.current) {
        history.back();
      }
    };
  }, [open]);

  const togglePresentationMode = useCallback(() => {
    setPresentationMode(prev => {
      const next = !prev;
      setHideFullscreenChrome(next);
      return next;
    });
  }, []);

  const handlePresentationModeOff = useCallback(() => {
    setPresentationMode(false);
    setHideFullscreenChrome(false);
  }, []);

  // ── Opponent edit form state ──────────────────────────────────────────────
  const [oppEditForm, setOppEditForm] = useState({ number: '', name: '' });
  const editingOpp = board.editingOppId
    ? board.opponents.find(o => o.id === board.editingOppId) ?? null
    : null;

  const handleOppDblClick = useCallback((id: string) => {
    const opp = board.opponents.find(o => o.id === id);
    if (opp) {
      setOppEditForm({ number: String(opp.number), name: opp.name ?? '' });
      board.handleOppDblClick(id);
    }
  }, [board]);

  const handleOppEditSave = useCallback(() => {
    if (!board.editingOppId) return;
    const num = parseInt(oppEditForm.number, 10);
    if (isNaN(num) || num < 1) return;
    board.handleOppEditSave(board.editingOppId, num, oppEditForm.name.trim());
  }, [board, oppEditForm]);

  const handleCloseRequest = useCallback(() => {
    if (board.isDirty) {
      setShowCloseWarning(true);
    } else {
      onClose();
    }
  }, [board.isDirty, onClose]);

  const handleSaveAndClose = useCallback(async () => {
    setShowCloseWarning(false);
    await board.handleSave();
    onClose();
  }, [board, onClose]);

  const tacticToDelete = tacticToDeleteId
    ? board.tactics.find(tactic => tactic.id === tacticToDeleteId) ?? null
    : null;

  const handleDeleteRequest = useCallback((id: string) => {
    setTacticToDeleteId(id);
  }, []);

  const handleConfirmDeleteTactic = useCallback(() => {
    if (!tacticToDeleteId) return;
    board.handleDeleteTactic(tacticToDeleteId);
    setTacticToDeleteId(null);
  }, [board, tacticToDeleteId]);

  const handleCancelDeleteTactic = useCallback(() => {
    setTacticToDeleteId(null);
  }, []);

  const handleSvgDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (presentationMode) return;
    board.handleSvgDown(e);
  }, [board, presentationMode]);

  const handleElDown = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    id: string,
    mode?: 'move' | 'start' | 'end' | 'resize',
  ) => {
    if (presentationMode) return;
    board.handleElDown(e, id, mode);
  }, [board, presentationMode]);

  const handleOppDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: string) => {
    if (presentationMode) return;
    board.handleOppDown(e, id);
  }, [board, presentationMode]);

  const handleOwnPlayerDown = useCallback((e: React.MouseEvent | React.TouchEvent, id: number, sx: number, sy: number) => {
    if (presentationMode) return;
    board.handleOwnPlayerDown(e, id, sx, sy);
  }, [board, presentationMode]);

  return (
    <>
    <Dialog
      open={open}
      onClose={handleCloseRequest}
      fullScreen
      PaperProps={{
        sx: { bgcolor: '#0a0f0a', color: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      }}
    >
      <Box
        ref={board.containerRef}
        onContextMenu={e => e.preventDefault()}
        sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0a0f0a', position: 'relative', overflow: 'hidden', WebkitTouchCallout: 'none', userSelect: 'none', pt: isMobile && isPortrait ? '64px' : 0 }}
      >
        {/* ── Portrait-mode hint (mobile only) ─────────────────────────── */}
        <PortraitHint visible={isMobile && isPortrait} />

        {/* ── Presentation mode: minimal exit overlay ───────────────────── */}
        {isPresentationMode && (
          <Box
            onClick={togglePresentationMode}
            sx={{
              position: 'absolute', top: 10, right: 10, zIndex: 200,
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.4,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
              opacity: 0.3,
              '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.12)' },
              transition: 'opacity 0.2s, background 0.2s',
            }}
          >
            <FullscreenExitIcon sx={{ fontSize: 16, color: 'white' }} />
            <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, fontSize: '0.72rem', userSelect: 'none' }}>
              Präsentation beenden
            </Typography>
          </Box>
        )}

        {/* ── Formation name – top left ─────────────────────────────────── */}
        {!isPresentationMode && (board.formationName || board.formationCode || formation?.formationType?.name) && (
        <Box sx={{ position: 'absolute', top: 10, left: leftBarOpen ? 82 : 10, zIndex: 90, display: 'flex', alignItems: 'center', gap: 0.75, pointerEvents: 'none', transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)' }}>
          {(board.formationName || formation?.formationType?.name) && (
            <Typography variant="body2" fontWeight={700} sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1, userSelect: 'none' }}>
              {board.formationName || formation?.formationType?.name}
            </Typography>
          )}
          {board.formationCode && (
            <Chip label={board.formationCode} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', fontWeight: 700, fontSize: '0.7rem', height: 20, border: '1px solid rgba(255,255,255,0.1)' }} />
          )}
        </Box>
        )}

        {/* ── Floating action buttons – top right (slides up to hide) ─────── */}
        {!isPresentationMode && (
        <Box sx={{
          position: 'absolute', top: 0, right: rightBarOpen ? 202 : 10, zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          transform: topActionsVisible ? 'translateY(0)' : 'translateY(calc(-100% + 14px))',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), right 0.2s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* Buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pt: 1.25 }}>
            {board.saveMsg && (
              <Typography variant="caption" sx={{ color: board.saveMsg.ok ? '#69f0ae' : '#ff5252', fontWeight: 700, fontSize: '0.72rem', animation: 'fadeIn 0.3s ease', '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } } }}>
                {board.saveMsg.text}
              </Typography>
            )}
            {formation && (
              <Tooltip title={`Speichern${board.isDirty ? ' – ungespeicherte Änderungen' : ''}`} placement="left">
                <IconButton
                  aria-label="Speichern"
                  onClick={board.saving ? undefined : board.handleSave}
                  sx={{
                    color: board.isDirty ? 'primary.light' : 'rgba(255,255,255,0.5)',
                    bgcolor: board.isDirty ? 'rgba(33,150,243,0.18)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${board.isDirty ? 'rgba(33,150,243,0.45)' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 1.75,
                    position: 'relative',
                    '&:hover': { bgcolor: board.isDirty ? 'rgba(33,150,243,0.3)' : 'rgba(255,255,255,0.12)' },
                  }}
                >
                  {board.saving ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : <SaveIcon />}
                  {board.isDirty && !board.saving && (
                    <Box sx={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', bgcolor: '#2196f3', border: '1.5px solid #0a0f0a' }} />
                  )}
                </IconButton>
              </Tooltip>
            )}
            <IconButton
              aria-label="Board schließen"
              onClick={handleCloseRequest}
              sx={{
                color: 'rgba(255,255,255,0.78)',
                bgcolor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 1.75,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          {/* Drawer-Tab – always visible, tap to slide in/out */}
          <Box
            role="button"
            aria-label={topActionsVisible ? 'Aktionsleiste ausblenden' : 'Aktionsleiste einblenden'}
            onClick={() => setTopActionsVisible(v => !v)}
            sx={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              width: 52, height: 14, mt: 0.5, cursor: 'pointer',
              borderRadius: '0 0 8px 8px',
              bgcolor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderTop: 'none',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.11)' },
              transition: 'background 0.15s',
            }}
          >
            <Box sx={{ width: 28, height: 3, borderRadius: 2, bgcolor: topActionsVisible ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.38)' }} />
          </Box>
        </Box>
        )}

        {/* ── Hauptbereich: Pitch (füllt immer den ganzen Raum) ───────────── */}
        <Box sx={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Left sidebar (tools) – overlay, does not affect pitch size */}
        {!isPresentationMode && leftBarOpen && (
          <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 40, display: 'flex' }}>
            <TacticsToolbar
              isLandscapeMobile={true}
              notes={board.notes}
              tool={board.tool}            setTool={board.setTool}
              color={board.color}          setColor={board.setColor}
              fullPitch={board.fullPitch}  setFullPitch={board.setFullPitch}
              fitPitchToHeight={effectiveFitPitchToHeight}
              setFitPitchToHeight={setFitPitchToHeight}
              elements={board.elements}    opponents={board.opponents}
              saving={board.saving}        saveMsg={board.saveMsg}
              isBrowserFS={board.isBrowserFS}
              isDirty={board.isDirty}
              showNotes={board.showNotes}  setShowNotes={board.setShowNotes}
              formation={formation}
              onAddOpponent={board.handleAddOpponent}
              onUndo={board.handleUndo}
              onClear={board.handleClear}
              onResetPlayerPositions={board.handleResetPlayerPositions}
              onSave={board.handleSave}
              onToggleFullscreen={board.toggleFullscreen}
              onLoadPreset={board.handleLoadPreset}
              activeTactic={board.activeTactic}
              selectedId={board.selectedId}
              onDeleteSelected={board.handleDeleteSelected}
              canUndo={board.canUndo}
              canRedo={board.canRedo}
              onRedo={board.handleRedo}
              showStepNumbers={showStepNumbers}
              onToggleStepNumbers={() => setShowStepNumbers(v => !v)}
              presentationMode={presentationMode}
              onTogglePresentationMode={togglePresentationMode}
            />
          </Box>
        )}

        {/* Left sidebar toggle strip – inner (right) edge, away from screen corners */}
        {!isPresentationMode && (
          <Box
            role="button"
            aria-label={leftBarOpen ? 'Linke Werkzeugleiste schließen' : 'Linke Werkzeugleiste öffnen'}
            onClick={() => setLeftBarOpen(v => !v)}
            sx={{ position: 'absolute', left: leftBarOpen ? 52 : 0, top: 0, bottom: 0, width: 22, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, cursor: 'pointer', bgcolor: leftBarOpen ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)', borderLeft: '1px solid rgba(255,255,255,0.12)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }, transition: 'background 0.15s, left 0.2s' }}
          >
            <ChevronLeftIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', transform: leftBarOpen ? 'none' : 'scaleX(-1)', transition: 'transform 0.2s' }} />
            <Typography sx={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '0.5rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', userSelect: 'none' }}>TOOLS</Typography>
          </Box>
        )}

        {/* Right sidebar toggle strip – inner (left) edge, away from screen corners */}
        <Box
          role="button"
          aria-label={rightBarOpen ? 'Rechte Taktikleiste schließen' : 'Rechte Taktikleiste öffnen'}
          onClick={() => setRightBarOpen(v => !v)}
          sx={{ position: 'absolute', right: rightBarOpen ? 180 : 0, top: isPresentationMode ? 44 : 0, bottom: 0, width: 22, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, cursor: 'pointer', bgcolor: rightBarOpen ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.12)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }, transition: 'background 0.15s, right 0.2s' }}
        >
          <Typography sx={{ writingMode: 'vertical-rl', fontSize: '0.5rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', userSelect: 'none' }}>TAKTIKEN</Typography>
          <ChevronRightIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', transform: rightBarOpen ? 'scaleX(-1)' : 'none', transition: 'transform 0.2s' }} />
        </Box>

        {/* Right sidebar (tactics) – overlay, does not affect pitch size */}
        {rightBarOpen && (
          <Box sx={{ position: 'absolute', right: 0, top: isPresentationMode ? 44 : 0, bottom: 0, width: 180, zIndex: 40, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(10,14,10,0.88)', borderLeft: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
            <TacticsBar
              vertical
              tactics={board.tactics}
              activeTacticId={board.activeTacticId}
              renamingId={board.renamingId}
              renameValue={board.renameValue}
              onSelect={board.setActiveTacticId}
              onNew={board.handleNewTactic}
              onDelete={handleDeleteRequest}
              onStartRename={(id, name) => { board.setRenamingId(id); board.setRenameValue(name); }}
              onRenameChange={board.setRenameValue}
              onConfirmRename={board.confirmRename}
              onCancelRename={() => board.setRenamingId(null)}
              onLoadPreset={board.handleLoadPreset}
              activeTactic={board.activeTactic}
              presentationMode={isPresentationMode}
            />
          </Box>
        )}

        {/* ═══ PITCH + NOTES ═══════════════════════════════════════════════ */}
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: effectiveFitPitchToHeight ? 'center' : 'flex-start', justifyContent: 'center', gap: 2, p: { xs: 0.5, md: 1 }, overflow: effectiveFitPitchToHeight ? 'hidden' : 'auto' }}>
          {board.isBrowserFS && isPresentationMode && (
            <Box
              sx={{
                position: 'absolute',
                top: { xs: 10, md: 16 },
                right: { xs: 10, md: 16 },
                zIndex: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 0.75,
                borderRadius: 2,
                bgcolor: 'rgba(10,15,10,0.72)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 14px 32px rgba(0,0,0,0.32)',
              }}
            >
              <Button
                aria-label="Leisten einblenden"
                onClick={() => setHideFullscreenChrome(false)}
                startIcon={<VisibilityIcon sx={{ fontSize: 18 }} />}
                sx={{
                  minWidth: 0,
                  px: 1.2,
                  py: 0.55,
                  borderRadius: 1.5,
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.16)' },
                }}
              >
                Leisten einblenden
              </Button>

              {presentationMode && (
                <Button
                  aria-label="Präsentation beenden"
                  onClick={handlePresentationModeOff}
                  sx={{
                    minWidth: 0,
                    px: 1.2,
                    py: 0.55,
                    borderRadius: 1.5,
                    color: 'rgba(255,255,255,0.9)',
                    bgcolor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                  }}
                >
                  Präsentation beenden
                </Button>
              )}

              <IconButton
                aria-label="Vollbild beenden"
                onClick={board.toggleFullscreen}
                sx={{
                  color: 'rgba(255,255,255,0.86)',
                  bgcolor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                }}
              >
                <FullscreenExitIcon />
              </IconButton>
            </Box>
          )}

          <PitchCanvas
            pitchRef={board.pitchRef}
            svgRef={board.svgRef}
            fullPitch={board.fullPitch}
            fitPitchToHeight={effectiveFitPitchToHeight}
            pitchAspect={board.pitchAspect}
            pitchAX={board.pitchAX}
            svgCursor={board.svgCursor}
            elements={board.elements}
            opponents={board.opponents}
            ownPlayers={board.ownPlayers}
            tool={board.tool}
            color={board.color}
            elDrag={board.elDrag}
            oppDrag={board.oppDrag}
            ownPlayerDrag={board.ownPlayerDrag}
            onSvgDown={handleSvgDown}
            onSvgMove={board.handleSvgMove}
            onSvgUp={board.handleSvgUp}
            onSvgLeave={board.handleSvgLeave}
            onElDown={handleElDown}
            onOppDown={handleOppDown}
            onOppDblClick={presentationMode ? () => undefined : handleOppDblClick}
            onOwnPlayerDown={handleOwnPlayerDown}
            markerId={board.markerId}
            selectedId={board.selectedId}
            registerElRef={board.registerElRef}
            registerOppRef={board.registerOppRef}
            registerPlayerRef={board.registerPlayerRef}
            registerPreviewPathRef={board.registerPreviewPathRef}
            registerPreviewEllipseRef={board.registerPreviewEllipseRef}
            showStepNumbers={showStepNumbers}
            presentationMode={presentationMode}
          />
          {board.showNotes && board.notes && (
            <Box sx={{ maxWidth: 248, width: '100%', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, p: 2, alignSelf: 'flex-start', mt: 1, backdropFilter: 'blur(4px)' }}>
              <Typography variant="caption" fontWeight={800} letterSpacing={2} sx={{ color: '#ffd600', fontSize: '0.65rem', display: 'block', mb: 1 }}>
                TAKTIK-NOTIZEN
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.65, fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>
                {board.notes}
              </Typography>
            </Box>
          )}
        </Box>

        </Box>{/* end full-screen pitch area */}

        {!isPresentationMode && !isMobile && (
        <StatusBar
          tool={board.tool}
          elements={board.elements}
          opponents={board.opponents}
          isBrowserFS={board.isBrowserFS}
        />
        )}

        {/* ── Team-Briefing (button + overlay) ─────────────────────────── */}
        {isPresentationMode && <TeamBriefing onLosgehts={() => { handlePresentationModeOff(); onClose(); }} />}
      </Box>
    </Dialog>

    {/* ── Gegner-Badge bearbeiten ──────────────────────────────────────── */}
    <Dialog
      open={Boolean(editingOpp)}
      onClose={board.handleOppEditClose}
      container={getDialogContainer}
      PaperProps={{
        sx: {
          bgcolor: '#1f2937', color: '#e5e7eb',
          borderRadius: 2, border: '1px solid #374151', minWidth: 300,
        },
      }}
    >
      <DialogTitle sx={{ color: '#f9fafb', fontWeight: 700, pb: 0.5 }}>
        Gegner-Badge bearbeiten
      </DialogTitle>
      <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Nummer"
          type="number"
          value={oppEditForm.number}
          onChange={e => setOppEditForm(f => ({ ...f, number: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && handleOppEditSave()}
          slotProps={{ htmlInput: { min: 1, max: 99 }, input: { startAdornment: <InputAdornment position="start">#</InputAdornment> } }}
          size="small"
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': { color: '#f3f4f6', '& fieldset': { borderColor: '#4b5563' }, '&:hover fieldset': { borderColor: '#9ca3af' } },
            '& .MuiInputLabel-root': { color: '#9ca3af' },
            '& .MuiInputAdornment-root': { color: '#6b7280' },
          }}
        />
        <TextField
          label="Name / Beschriftung"
          placeholder="z. B. Stürmer 9"
          value={oppEditForm.name}
          onChange={e => setOppEditForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && handleOppEditSave()}
          size="small"
          fullWidth
          inputProps={{ maxLength: 20 }}
          sx={{
            '& .MuiOutlinedInput-root': { color: '#f3f4f6', '& fieldset': { borderColor: '#4b5563' }, '&:hover fieldset': { borderColor: '#9ca3af' } },
            '& .MuiInputLabel-root': { color: '#9ca3af' },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button
          onClick={board.handleOppEditClose}
          sx={{ color: '#9ca3af', textTransform: 'none' }}
        >
          Abbrechen
        </Button>
        <Button
          onClick={handleOppEditSave}
          variant="contained"
          sx={{ textTransform: 'none', bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
        >
          Übernehmen
        </Button>
      </DialogActions>
    </Dialog>

    {/* ── Unsaved changes warning ─────────────────────────────────────── */}
    <Dialog
      open={showCloseWarning}
      onClose={() => setShowCloseWarning(false)}
      container={getDialogContainer}
      PaperProps={{
        sx: {
          bgcolor: '#1f2937',
          color: '#e5e7eb',
          borderRadius: 2,
          border: '1px solid #374151',
          minWidth: 340,
        },
      }}
    >
      <DialogTitle sx={{ color: '#f9fafb', fontWeight: 700, pb: 1 }}>
        Ungespeicherte Änderungen
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <DialogContentText sx={{ color: '#9ca3af' }}>
          Die aktuelle Taktik ist noch nicht auf dem Server gespeichert. Wenn du jetzt schließt,
          bleibt ein lokaler Entwurf auf diesem Gerät erhalten und wird beim nächsten Öffnen automatisch wiederhergestellt.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button
          onClick={() => setShowCloseWarning(false)}
          sx={{ color: '#9ca3af', textTransform: 'none' }}
        >
          Weiter bearbeiten
        </Button>
        <Button
          onClick={() => { setShowCloseWarning(false); onClose(); }}
          color="error"
          variant="outlined"
          sx={{ textTransform: 'none', borderColor: '#ef4444', color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
        >
          Lokal schließen
        </Button>
        <Button
          onClick={handleSaveAndClose}
          variant="contained"
          sx={{ textTransform: 'none', bgcolor: '#1d4ed8', '&:hover': { bgcolor: '#1e40af' } }}
        >
          Speichern & Schließen
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog
      open={Boolean(tacticToDelete)}
      onClose={handleCancelDeleteTactic}
      container={getDialogContainer}
      PaperProps={{
        sx: {
          bgcolor: '#1f2937',
          color: '#e5e7eb',
          borderRadius: 2,
          border: '1px solid #374151',
          minWidth: 340,
        },
      }}
    >
      <DialogTitle sx={{ color: '#f9fafb', fontWeight: 700, pb: 1 }}>
        Taktik löschen?
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <DialogContentText sx={{ color: '#9ca3af' }}>
          Soll die Taktik &quot;{tacticToDelete?.name ?? 'Diese Taktik'}&quot; wirklich gelöscht werden?
          Diese Aktion kann nicht rückgängig gemacht werden.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button
          onClick={handleCancelDeleteTactic}
          sx={{ color: '#9ca3af', textTransform: 'none' }}
        >
          Abbrechen
        </Button>
        <Button
          onClick={handleConfirmDeleteTactic}
          color="error"
          variant="contained"
          sx={{ textTransform: 'none', bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
        >
          Löschen
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default TacticsBoardModal;
