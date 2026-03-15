// ─── TacticsBoard – toolbar (tools, colors, save, fullscreen) ─────────────────
import React, { useState } from 'react';
import {
  Box, Chip, Divider, Tooltip, Typography, CircularProgress,
} from '@mui/material';
import CloseIcon          from '@mui/icons-material/Close';
import FullscreenIcon     from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import UndoIcon           from '@mui/icons-material/Undo';
import DeleteSweepIcon    from '@mui/icons-material/DeleteSweep';
import RestartAltIcon     from '@mui/icons-material/RestartAlt';
import TouchAppIcon       from '@mui/icons-material/TouchApp';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PersonAddIcon   from '@mui/icons-material/PersonAdd';
import SaveIcon        from '@mui/icons-material/Save';
import BookmarksIcon   from '@mui/icons-material/BookmarksOutlined';

import { ToolBtn, ArrowToolIcon } from './ToolBtn';
import { PALETTE } from './constants';
import type { Tool, DrawElement, OpponentToken, TacticEntry, TacticPreset } from './types';
import type { Formation } from '../formation/types';
import { PresetPicker } from './PresetPicker';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TacticsToolbarProps {
  formationName: string;
  formationCode: string | undefined;
  notes: string | undefined;

  tool: Tool;
  setTool: (t: Tool) => void;

  color: string;
  setColor: (c: string) => void;

  fullPitch: boolean;
  setFullPitch: React.Dispatch<React.SetStateAction<boolean>>;

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
  onClose: () => void;
  /** Called when the user picks a preset – creates a new tactic tab */
  onLoadPreset: (preset: TacticPreset) => void;
  /** Data of the currently active tactic, used by the save-as-preset form */
  activeTactic: TacticEntry | undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TacticsToolbar: React.FC<TacticsToolbarProps> = ({
  formationName, formationCode, notes,
  tool, setTool,
  color, setColor,
  fullPitch, setFullPitch,
  elements, opponents,
  saving, saveMsg, isBrowserFS, isDirty, showNotes, setShowNotes,
  formation,
  onAddOpponent, onUndo, onClear, onResetPlayerPositions, onSave, onToggleFullscreen, onClose,
  onLoadPreset, activeTactic,
}) => {
  const [presetAnchor, setPresetAnchor] = useState<Element | null>(null);

  return (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 0.5,
    px: 1.5, py: 0.75,
    bgcolor: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0, flexWrap: 'wrap', minHeight: 52,
  }}>

    {/* Formation name + code */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
      <Typography variant="subtitle1" fontWeight={700}
        sx={{ color: 'white', lineHeight: 1, whiteSpace: 'nowrap' }}>
        {formationName}
      </Typography>
      {formationCode && (
        <Chip label={formationCode} size="small"
          sx={{
            bgcolor: 'primary.main', color: 'white',
            fontWeight: 700, fontSize: '0.7rem', height: 22,
          }}
        />
      )}
    </Box>

    <Divider orientation="vertical" flexItem
      sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />

    {/* Drawing tools */}
    <ToolBtn active={tool === 'pointer'}
      title="Auswahl – ziehen=verschieben, tippen=löschen"
      onClick={() => setTool('pointer')}>
      <TouchAppIcon sx={{ fontSize: 20 }} />
    </ToolBtn>
    <ToolBtn active={tool === 'arrow'}
      title="Bewegungspfeil (Pass / Ballweg)"
      onClick={() => setTool('arrow')}>
      <ArrowToolIcon />
    </ToolBtn>
    <ToolBtn active={tool === 'run'}
      title="Laufweg (Spieler ohne Ball, gestrichelt)"
      onClick={() => setTool('run')}>
      <ArrowToolIcon dashed />
    </ToolBtn>
    <ToolBtn active={tool === 'zone'}
      title="Zone markieren (Kreis)"
      onClick={() => setTool('zone')}>
      <RadioButtonUncheckedIcon sx={{ fontSize: 20 }} />
    </ToolBtn>

    <Divider orientation="vertical" flexItem
      sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />

    {/* Add opponent – only in full-pitch mode */}
    {fullPitch && (
      <Tooltip
        title="Gegner-Token hinzufügen (linke Feldhälfte)"
        arrow placement="bottom">
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
            '&:hover': { bgcolor: 'rgba(244,67,54,0.28)' },
            transition: 'background 0.15s',
          }}
        >
          <PersonAddIcon sx={{ fontSize: 16 }} />
          <span>Gegner</span>
        </Box>
      </Tooltip>
    )}

    {/* Half / Full pitch toggle */}
    <Tooltip
      title={fullPitch
        ? 'Zur Spielfeldhälfte wechseln (nur eigene Hälfte, kein Gegner)'
        : 'Zum vollen Spielfeld wechseln (beide Hälften)'}
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
          userSelect: 'none',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{fullPitch ? '⬛' : '⬜'}</span>
        <span>{fullPitch ? 'Volles Feld' : 'Hälfte'}</span>
      </Box>
    </Tooltip>

    {/* Vorlagen */}
    <Tooltip title="Taktik-Vorlagen laden oder speichern" arrow placement="bottom">
      <Box
        onClick={e => setPresetAnchor(e.currentTarget)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          px: 1, py: 0.5,
          bgcolor: presetAnchor ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.07)',
          border: `1px solid ${presetAnchor ? 'rgba(250,204,21,0.5)' : 'rgba(255,255,255,0.18)'}`,
          borderRadius: 1.5, cursor: 'pointer',
          color: presetAnchor ? '#facc15' : 'rgba(255,255,255,0.75)',
          fontSize: '0.72rem', fontWeight: 700, userSelect: 'none',
          '&:hover': { bgcolor: 'rgba(250,204,21,0.12)', borderColor: 'rgba(250,204,21,0.4)', color: '#facc15' },
          transition: 'all 0.15s',
        }}
      >
        <BookmarksIcon sx={{ fontSize: 15 }} />
        <span>Vorlagen</span>
      </Box>
    </Tooltip>

    <PresetPicker
      anchorEl={presetAnchor}
      onClose={() => setPresetAnchor(null)}
      onLoadPreset={preset => { onLoadPreset(preset); setPresetAnchor(null); }}
      currentTacticData={activeTactic}
    />

    <Divider orientation="vertical" flexItem
      sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />

    {/* Color palette */}
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

    <Divider orientation="vertical" flexItem
      sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />

    {/* Undo / Clear */}
    <ToolBtn title="Letzte Zeichnung rückgängig"
      onClick={onUndo} disabled={elements.length === 0}>
      <UndoIcon fontSize="small" />
    </ToolBtn>
    <ToolBtn title="Alles löschen (Zeichnungen + Gegner)"
      onClick={onClear}
      disabled={elements.length === 0 && opponents.length === 0}>
      <DeleteSweepIcon fontSize="small" />
    </ToolBtn>
    <ToolBtn title="Spielerpositionen zurücksetzen (auf Formations-Standard)"
      onClick={onResetPlayerPositions}>
      <RestartAltIcon fontSize="small" />
    </ToolBtn>

    {/* Notes toggle */}
    {notes && (
      <>
        <Divider orientation="vertical" flexItem
          sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />
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
      </>
    )}

    <Box sx={{ flex: 1 }} />

    {/* Save feedback */}
    {saveMsg && (
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
    {formation && (
      <Tooltip
        title="Taktik speichern – Gegner-Positionen & Zeichnungen werden in der Aufstellung gespeichert"
        arrow placement="bottom">
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

    <Divider orientation="vertical" flexItem
      sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 0.5 }} />

    {/* Fullscreen + Close */}
    <ToolBtn
      title={isBrowserFS ? 'Vollbild beenden' : 'Vollbild – Beamer-Modus'}
      onClick={onToggleFullscreen}>
      {isBrowserFS ? <FullscreenExitIcon /> : <FullscreenIcon />}
    </ToolBtn>
    <ToolBtn title="Schließen" onClick={onClose}>
      <CloseIcon />
    </ToolBtn>
  </Box>
  );
};
