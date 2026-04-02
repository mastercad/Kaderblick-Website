// ─── TacticsBoard – toolbar (tools, colors, save, fullscreen) ─────────────────
import React, { useState } from 'react';
import {
  Box, Chip, Divider, Tooltip, Typography, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, useTheme,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import FullscreenIcon     from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import UndoIcon           from '@mui/icons-material/Undo';
import RedoIcon           from '@mui/icons-material/Redo';
import DeleteSweepIcon    from '@mui/icons-material/DeleteSweep';
import DeleteIcon         from '@mui/icons-material/Delete';
import RestartAltIcon     from '@mui/icons-material/RestartAlt';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PersonAddIcon   from '@mui/icons-material/PersonAdd';
import SaveIcon        from '@mui/icons-material/Save';
import BookmarksIcon            from '@mui/icons-material/BookmarksOutlined';
import FormatListNumberedIcon   from '@mui/icons-material/FormatListNumbered';
import PresentToAllIcon         from '@mui/icons-material/PresentToAll';

import { ToolBtn, ArrowToolIcon } from './ToolBtn';
import { PALETTE } from './constants';
import type { Tool, DrawElement, OpponentToken, TacticEntry, TacticPreset } from './types';
import type { Formation } from '../formation/types';
import { PresetPicker } from './PresetPicker';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TacticsToolbarProps {
  notes: string | undefined;

  tool: Tool;
  setTool: (t: Tool) => void;

  color: string;
  setColor: (c: string) => void;

  fullPitch: boolean;
  setFullPitch: React.Dispatch<React.SetStateAction<boolean>>;
  fitPitchToHeight: boolean;
  setFitPitchToHeight: React.Dispatch<React.SetStateAction<boolean>>;

  elements: DrawElement[];
  opponents: OpponentToken[];

  saving: boolean;
  saveMsg: { ok: boolean; text: string } | null;
  isBrowserFS: boolean;
  isDirty: boolean;
  showNotes: boolean;
  setShowNotes: React.Dispatch<React.SetStateAction<boolean>>;

  formation: Formation | null;

  onAddOpponent: () => void;
  onUndo: () => void;
  onClear: () => void;
  onResetPlayerPositions: () => void;
  onSave: () => void;
  onToggleFullscreen: () => void;
  /** Called when the user picks a preset – creates a new tactic tab */
  onLoadPreset: (preset: TacticPreset) => void;
  /** Data of the currently active tactic, used by the save-as-preset form */
  activeTactic: TacticEntry | undefined;

  /** Currently selected drawing/opponent element id (null = none) */
  selectedId: string | null;
  /** Delete the currently selected element */
  onDeleteSelected: () => void;

  /** Whether there is something on the undo stack */
  canUndo: boolean;
  /** Whether there is something on the redo stack */
  canRedo: boolean;
  onRedo: () => void;
  /** Whether step-order numbers are shown on arrows and zones */
  showStepNumbers: boolean;
  onToggleStepNumbers: () => void;
  presentationMode: boolean;
  onTogglePresentationMode: () => void;

}

// ─── Component ────────────────────────────────────────────────────────────────

export const TacticsToolbar: React.FC<TacticsToolbarProps> = ({
  notes,
  tool, setTool,
  color, setColor,
  fullPitch, setFullPitch,
  fitPitchToHeight, setFitPitchToHeight,
  elements, opponents,
  saving, saveMsg, isBrowserFS, isDirty, showNotes, setShowNotes,
  formation,
  onAddOpponent, onUndo, onClear, onResetPlayerPositions, onSave, onToggleFullscreen,
  onLoadPreset, activeTactic,
  selectedId, onDeleteSelected,
  canUndo, showStepNumbers, onToggleStepNumbers,
  canRedo, onRedo,
  presentationMode, onTogglePresentationMode,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const showFitPitchToggle = !(isMobile && isPortrait);
  const [presetAnchor, setPresetAnchor] = useState<Element | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const mobileGroupSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    flexShrink: 0,
    px: 0.5,
    py: 0.35,
    borderRadius: 2,
    bgcolor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  };

  return (
  <>
  <Box sx={{
    px: { xs: 1, md: 1.5 }, py: 0.75,
    bgcolor: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
    overflowX: { xs: 'auto', md: 'visible' },
    overflowY: 'hidden',
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
  }}>
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: { xs: 0.75, md: 0.5 },
      flexWrap: { xs: 'nowrap', md: 'wrap' },
      minWidth: 'max-content',
      minHeight: 52,
    }}>

    {/* ── Drawing tools – labeled buttons for zero-learning-curve UX ─────── */}
    <Box sx={isMobile ? mobileGroupSx : { display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <LabeledToolBtn active={tool === 'arrow'} onClick={() => setTool('arrow')}
        label="Ballweg" tooltip="Passpfeil / Ballweg zeichnen – einfach auf das Feld ziehen" compact={isMobile}>
        <ArrowToolIcon />
      </LabeledToolBtn>
      <LabeledToolBtn active={tool === 'run'} onClick={() => setTool('run')}
        label="Laufweg" tooltip="Laufweg eines Spielers zeichnen (gestrichelte Linie)" compact={isMobile}>
        <ArrowToolIcon dashed />
      </LabeledToolBtn>
      <LabeledToolBtn active={tool === 'zone'} onClick={() => setTool('zone')}
        label="Zone" tooltip="Bereich / Zone auf dem Feld markieren (Kreis ziehen)" compact={isMobile}>
        <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} />
      </LabeledToolBtn>
      {isBrowserFS && (
        <LabeledToolBtn active={presentationMode} onClick={onTogglePresentationMode}
          label="Präsent." tooltip="Präsentationsmodus: nur zeigen, nichts verschieben oder anlegen" compact={isMobile}>
          <PresentToAllIcon sx={{ fontSize: 18 }} />
        </LabeledToolBtn>
      )}
    </Box>

    {!isMobile && (
      <Divider orientation="vertical" flexItem
        sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />
    )}

    {/* Add opponent – only in full-pitch mode */}
    <Box sx={isMobile ? mobileGroupSx : { display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {fullPitch && (
        <Tooltip title="Roten Gegner-Token auf dem Feld platzieren (danach verschieben)" arrow placement="bottom">
          <Box
            onClick={onAddOpponent}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.5,
              bgcolor: 'rgba(244,67,54,0.15)',
              border: '1px solid rgba(244,67,54,0.4)',
              borderRadius: 1.5, cursor: 'pointer',
              color: '#ff8a80', fontSize: '0.72rem', fontWeight: 700,
              userSelect: 'none',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: 'rgba(244,67,54,0.28)' },
              transition: 'background 0.15s',
            }}
          >
            <PersonAddIcon sx={{ fontSize: 16 }} />
            <span>+ Gegner</span>
          </Box>
        </Tooltip>
      )}

      {/* Half / Full pitch toggle */}
      <Tooltip
        title={fullPitch
          ? 'Nur die eigene Spielfeldhälfte anzeigen'
          : 'Komplettes Spielfeld mit beiden Hälften anzeigen'}
        arrow placement="bottom">
        <Box
          onClick={() => setFullPitch(v => !v)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1, py: 0.5,
            bgcolor: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 1.5, cursor: 'pointer',
            color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', fontWeight: 700,
            userSelect: 'none', whiteSpace: 'nowrap',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
            transition: 'background 0.15s',
          }}
        >
          <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{fullPitch ? '⬛' : '⬜'}</span>
          <span>{isMobile ? (fullPitch ? 'Ganzes Feld' : 'Halbes Feld') : (fullPitch ? 'Volles Feld' : 'Hälfte')}</span>
        </Box>
      </Tooltip>

      {/* Vorlagen */}
      <Tooltip title="Fertige Taktik-Vorlagen laden oder aktuelle Taktik als Vorlage speichern" arrow placement="bottom">
        <Box
          onClick={e => setPresetAnchor(e.currentTarget)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1, py: 0.5,
            bgcolor: presetAnchor ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.07)',
            border: `1px solid ${presetAnchor ? 'rgba(250,204,21,0.5)' : 'rgba(255,255,255,0.18)'}`,
            borderRadius: 1.5, cursor: 'pointer',
            color: presetAnchor ? '#facc15' : 'rgba(255,255,255,0.75)',
            fontSize: '0.72rem', fontWeight: 700, userSelect: 'none', whiteSpace: 'nowrap',
            '&:hover': { bgcolor: 'rgba(250,204,21,0.12)', borderColor: 'rgba(250,204,21,0.4)', color: '#facc15' },
            transition: 'all 0.15s',
          }}
        >
          <BookmarksIcon sx={{ fontSize: 15 }} />
          <span>Vorlagen</span>
        </Box>
      </Tooltip>
    </Box>

    <PresetPicker
      anchorEl={presetAnchor}
      onClose={() => setPresetAnchor(null)}
      onLoadPreset={preset => { onLoadPreset(preset); setPresetAnchor(null); }}
      currentTacticData={activeTactic}
    />

    {!isMobile && (
      <Divider orientation="vertical" flexItem
        sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />
    )}

    {/* Color palette */}
    <Box sx={isMobile ? mobileGroupSx : { display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {PALETTE.map(c => (
        <Tooltip key={c.value} title={c.label} arrow placement="bottom">
          <Box
            onClick={() => setColor(c.value)}
            sx={{
              width: 22, height: 22, borderRadius: '50%',
              bgcolor: c.value, cursor: 'pointer', flexShrink: 0,
              border: color === c.value
                ? '2.5px solid white'
                : '2.5px solid rgba(255,255,255,0.15)',
              boxShadow: color === c.value
                ? `0 0 0 2px rgba(255,255,255,0.4), 0 0 8px ${c.value}88`
                : 'none',
              transition: 'box-shadow 0.15s',
            }}
          />
        </Tooltip>
      ))}
    </Box>

    {!isMobile && (
      <Divider orientation="vertical" flexItem
        sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />
    )}

    {/* ── Edit actions ──────────────────────────────────────────────────── */}
    {/* Delete selected: prominent when something is selected */}
    <Box sx={isMobile ? mobileGroupSx : { display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Tooltip title={selectedId ? 'Ausgewähltes Element löschen (oder Entf-Taste)' : 'Nichts ausgewählt – Element antippen zum Auswählen'} arrow placement="bottom">
        <span>
          <Box
            component="button"
            onClick={onDeleteSelected}
            disabled={!selectedId}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.5,
              bgcolor: selectedId ? 'rgba(244,67,54,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${selectedId ? 'rgba(244,67,54,0.6)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 1.5, cursor: selectedId ? 'pointer' : 'default',
              color: selectedId ? '#ff5252' : 'rgba(255,255,255,0.25)',
              fontSize: '0.72rem', fontWeight: 700, userSelect: 'none', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              '&:hover': selectedId ? { bgcolor: 'rgba(244,67,54,0.32)' } : {},
              '&:disabled': { opacity: 1 },
            }}
          >
            <DeleteIcon sx={{ fontSize: 16 }} />
            <span>Löschen</span>
          </Box>
        </span>
      </Tooltip>

      <ToolBtn title="Letzte Aktion rückgängig (Pfeil, Zone, Spieler, Gegner)" onClick={onUndo} disabled={!canUndo}>
        <UndoIcon fontSize="small" />
      </ToolBtn>
      <ToolBtn title="Wiederholen" onClick={onRedo} disabled={!canRedo}>
        <RedoIcon fontSize="small" />
      </ToolBtn>
      <ToolBtn title="Schrittnummerierung – zeigt die Reihenfolge der gezeichneten Elemente" onClick={onToggleStepNumbers} active={showStepNumbers}>
        <FormatListNumberedIcon fontSize="small" />
      </ToolBtn>
      <Tooltip title="Alle Zeichnungen und Gegner entfernen" arrow placement="bottom">
        <span>
          <Box
            component="button"
            onClick={() => setConfirmClear(true)}
            disabled={elements.length === 0 && opponents.length === 0}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 0.75, py: 0.5,
              bgcolor: 'transparent',
              border: '1px solid transparent',
              borderRadius: 1.5, cursor: 'pointer',
              color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem',
              userSelect: 'none', transition: 'all 0.15s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' },
              '&:disabled': { opacity: 0.3, cursor: 'default', '&:hover': { bgcolor: 'transparent' } },
            }}
          >
            <DeleteSweepIcon sx={{ fontSize: 18 }} />
          </Box>
        </span>
      </Tooltip>
      <Tooltip title="Spielerpositionen auf Formations-Standard zurücksetzen" arrow placement="bottom">
        <span>
          <Box
            component="button"
            onClick={onResetPlayerPositions}
            sx={{
              display: 'flex', alignItems: 'center',
              px: 0.75, py: 0.5,
              bgcolor: 'transparent', border: '1px solid transparent',
              borderRadius: 1.5, cursor: 'pointer',
              color: 'rgba(255,255,255,0.45)',
              userSelect: 'none', transition: 'all 0.15s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' },
            }}
          >
            <RestartAltIcon sx={{ fontSize: 18 }} />
          </Box>
        </span>
      </Tooltip>
    </Box>

    {/* Notes toggle */}
    {notes && (
      <>
        {!isMobile && (
          <Divider orientation="vertical" flexItem
            sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />
        )}
        <Box sx={isMobile ? mobileGroupSx : { display: 'flex', alignItems: 'center' }}>
          <Chip
            label="Notizen"
            size="small"
            onClick={() => setShowNotes(v => !v)}
            sx={{
              bgcolor:  showNotes ? 'rgba(255,235,59,0.2)' : 'rgba(255,255,255,0.07)',
              color:    showNotes ? '#ffd600' : 'rgba(255,255,255,0.6)',
              border:   showNotes ? '1px solid rgba(255,214,0,0.4)' : '1px solid transparent',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem',
            }}
          />
        </Box>
      </>
    )}

    {!isMobile && <Box sx={{ flex: 1 }} />}

    {/* Save feedback */}
    {!isMobile && saveMsg && (
      <Typography variant="caption" sx={{
        color: saveMsg.ok ? '#69f0ae' : '#ff5252',
        fontWeight: 700, fontSize: '0.72rem', mr: 1,
        animation: 'fadeIn 0.3s ease',
        '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
      }}>
        {saveMsg.text}
      </Typography>
    )}

    {/* Save button */}
    {!isMobile && formation && (
      <Tooltip title="Taktik speichern" arrow placement="bottom">
        <Box
          onClick={saving ? undefined : onSave}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1.25, py: 0.5,
            bgcolor: 'rgba(33,150,243,0.18)',
            border: '1px solid rgba(33,150,243,0.45)',
            borderRadius: 1.5,
            cursor: saving ? 'default' : 'pointer',
            color: saving ? 'rgba(255,255,255,0.4)' : 'primary.light',
            fontSize: '0.72rem', fontWeight: 700, userSelect: 'none',
            '&:hover': { bgcolor: saving ? undefined : 'rgba(33,150,243,0.3)' },
            transition: 'background 0.15s',
          }}
        >
          {saving
            ? <CircularProgress size={14} sx={{ color: 'inherit' }} />
            : <SaveIcon sx={{ fontSize: 16 }} />
          }
          <span style={{ marginLeft: 3 }}>Speichern{isDirty ? ' *' : ''}</span>
        </Box>
      </Tooltip>
    )}

    {!isMobile && (
      <Divider orientation="vertical" flexItem
        sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />
    )}

    <Box sx={isMobile ? mobileGroupSx : { display: 'flex', alignItems: 'center' }}>
      {showFitPitchToggle && (
        <Tooltip
          title={fitPitchToHeight
            ? 'Aktuell an Höhe angepasst. Antippen für volle Breite.'
            : 'Aktuell volle Breite. Antippen für komplett sichtbares Feld.'}
          arrow
          placement="bottom"
        >
          <Box
            onClick={() => setFitPitchToHeight(v => !v)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.5,
              bgcolor: fitPitchToHeight ? 'rgba(255,255,255,0.07)' : 'rgba(33,150,243,0.18)',
              border: `1px solid ${fitPitchToHeight ? 'rgba(255,255,255,0.18)' : 'rgba(33,150,243,0.45)'}`,
              borderRadius: 1.5, cursor: 'pointer',
              color: fitPitchToHeight ? 'rgba(255,255,255,0.75)' : 'primary.light',
              fontSize: '0.72rem', fontWeight: 700, userSelect: 'none', whiteSpace: 'nowrap',
              '&:hover': { bgcolor: fitPitchToHeight ? 'rgba(255,255,255,0.14)' : 'rgba(33,150,243,0.3)' },
              transition: 'background 0.15s',
            }}
          >
            <span>{fitPitchToHeight ? 'Volle Breite' : 'An Hoehe anpassen'}</span>
          </Box>
        </Tooltip>
      )}

      <ToolBtn
        title={isBrowserFS ? 'Vollbild beenden' : 'Vollbild (ideal für Bildschirm / Beamer)'}
        onClick={onToggleFullscreen}>
        {isBrowserFS ? <FullscreenExitIcon /> : <FullscreenIcon />}
      </ToolBtn>
    </Box>
    </Box>
  </Box>

  {/* ── Bestätigung: Alles löschen ─────────────────────────────────────── */}
  <Dialog
    open={confirmClear}
    onClose={() => setConfirmClear(false)}
    PaperProps={{
      sx: {
        bgcolor: '#1f2937', color: '#e5e7eb',
        borderRadius: 2, border: '1px solid #374151', minWidth: 320,
      },
    }}
  >
    <DialogTitle sx={{ color: '#f9fafb', fontWeight: 700, pb: 1 }}>
      Alles löschen?
    </DialogTitle>
    <DialogContent sx={{ pt: 0 }}>
      <DialogContentText sx={{ color: '#9ca3af' }}>
        Alle Zeichnungen und Gegner-Token werden von der aktuellen Taktik entfernt. Die Spielerpositionen bleiben erhalten.
      </DialogContentText>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
      <Button onClick={() => setConfirmClear(false)} sx={{ color: '#9ca3af' }}>
        Abbrechen
      </Button>
      <Button
        onClick={() => { onClear(); setConfirmClear(false); }}
        variant="contained" color="error" sx={{ fontWeight: 700 }}
      >
        Alles löschen
      </Button>
    </DialogActions>
  </Dialog>
  </>
  );
};

// ── Labeled drawing tool button ────────────────────────────────────────────────

interface LabeledToolBtnProps {
  active: boolean;
  onClick: () => void;
  label: string;
  tooltip: string;
  compact?: boolean;
  children: React.ReactNode;
}

const LabeledToolBtn: React.FC<LabeledToolBtnProps> = ({ active, onClick, label, tooltip, compact, children }) => (
  <Tooltip title={tooltip} arrow placement="bottom">
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: 'center',
        gap: compact ? 0.45 : 0.2, px: compact ? 0.9 : 1, py: compact ? 0.55 : 0.4, cursor: 'pointer',
        bgcolor: active ? 'rgba(33,150,243,0.18)' : 'transparent',
        border: active ? '1px solid rgba(33,150,243,0.5)' : '1px solid transparent',
        borderRadius: 1.5, userSelect: 'none',
        color: active ? 'primary.light' : 'rgba(255,255,255,0.6)',
        whiteSpace: 'nowrap',
        '&:hover': { bgcolor: active ? 'rgba(33,150,243,0.25)' : 'rgba(255,255,255,0.08)', color: active ? 'primary.light' : 'rgba(255,255,255,0.88)' },
        transition: 'all 0.15s',
        minWidth: 38,
      }}
    >
      {children}
      <Typography sx={{
        fontSize: compact ? '0.66rem' : '0.58rem', fontWeight: active ? 700 : 500,
        lineHeight: 1, color: 'inherit', whiteSpace: 'nowrap',
      }}>
        {label}
      </Typography>
    </Box>
  </Tooltip>
);
