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
import React, { useState, useCallback } from 'react';
import {
  Dialog, Box, Typography,
  DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
  TextField, InputAdornment,
} from '@mui/material';
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

  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [showStepNumbers, setShowStepNumbers] = useState(false);

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
        sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0a0f0a' }}
      >
        <TacticsToolbar
          formationName={board.formationName}
          formationCode={board.formationCode}
          notes={board.notes}
          tool={board.tool}            setTool={board.setTool}
          color={board.color}          setColor={board.setColor}
          fullPitch={board.fullPitch}  setFullPitch={board.setFullPitch}
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
          onClose={handleCloseRequest}
          onLoadPreset={board.handleLoadPreset}
          activeTactic={board.activeTactic}
          selectedId={board.selectedId}
          onDeleteSelected={board.handleDeleteSelected}
          canUndo={board.canUndo}
          canRedo={board.canRedo}
          onRedo={board.handleRedo}
          showStepNumbers={showStepNumbers}
          onToggleStepNumbers={() => setShowStepNumbers(v => !v)}
        />

        <TacticsBar
          tactics={board.tactics}
          activeTacticId={board.activeTacticId}
          renamingId={board.renamingId}
          renameValue={board.renameValue}
          onSelect={board.setActiveTacticId}
          onNew={board.handleNewTactic}
          onDelete={board.handleDeleteTactic}
          onStartRename={(id, name) => { board.setRenamingId(id); board.setRenameValue(name); }}
          onRenameChange={board.setRenameValue}
          onConfirmRename={board.confirmRename}
          onCancelRename={() => board.setRenamingId(null)}
        />

        {/* ═══ PITCH + NOTES ═══════════════════════════════════════════════ */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, p: { xs: 1, md: 2 }, overflow: 'hidden' }}>
          <PitchCanvas
            pitchRef={board.pitchRef}
            svgRef={board.svgRef}
            fullPitch={board.fullPitch}
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
            onSvgDown={board.handleSvgDown}
            onSvgMove={board.handleSvgMove}
            onSvgUp={board.handleSvgUp}
            onSvgLeave={board.handleSvgLeave}
            onElDown={board.handleElDown}
            onOppDown={board.handleOppDown}
            onOppDblClick={handleOppDblClick}
            onOwnPlayerDown={board.handleOwnPlayerDown}
            markerId={board.markerId}
            selectedId={board.selectedId}
            registerElRef={board.registerElRef}
            registerOppRef={board.registerOppRef}
            registerPlayerRef={board.registerPlayerRef}
            registerPreviewPathRef={board.registerPreviewPathRef}
            registerPreviewEllipseRef={board.registerPreviewEllipseRef}
            showStepNumbers={showStepNumbers}
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

        <StatusBar
          tool={board.tool}
          elements={board.elements}
          opponents={board.opponents}
          isBrowserFS={board.isBrowserFS}
        />
      </Box>
    </Dialog>

    {/* ── Gegner-Badge bearbeiten ──────────────────────────────────────── */}
    <Dialog
      open={Boolean(editingOpp)}
      onClose={board.handleOppEditClose}
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
          Die aktuelle Taktik wurde noch nicht gespeichert. Wenn du jetzt schließt, gehen alle Änderungen verloren.
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
          Schließen ohne Speichern
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
    </>
  );
};

export default TacticsBoardModal;
