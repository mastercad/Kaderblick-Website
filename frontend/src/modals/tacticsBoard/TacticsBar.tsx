// ─── TacticsBoard – tactic tab bar ────────────────────────────────────────────
import React, { useState, useRef, useCallback } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import BookmarksIcon from '@mui/icons-material/BookmarksOutlined';
import { PresetPicker } from './PresetPicker';
import type { TacticEntry, TacticPreset } from './types';

// ─── TacticItem (vertical mode) – handles long-press rename ─────────────────

interface TacticItemProps {
  tactic: TacticEntry;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  canDelete: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

const LONG_PRESS_MS = 500;

const TacticItem: React.FC<TacticItemProps> = ({
  tactic, isActive, isRenaming, renameValue, canDelete,
  onSelect, onStartRename, onRenameChange, onConfirmRename, onCancelRename, onDelete,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const startPress = useCallback(() => {
    didLongPress.current = false;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      onStartRename();
    }, LONG_PRESS_MS);
  }, [onStartRename]);

  const cancelPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (didLongPress.current) return; // already handled by long-press
    onSelect();
  }, [onSelect]);

  return (
    <Box
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onClick={handleClick}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5,
        px: 1, py: 0.75,
        bgcolor: isActive ? 'rgba(33,150,243,0.2)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isActive ? 'rgba(33,150,243,0.5)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '8px', cursor: 'pointer',
        transition: 'all 0.15s',
        '&:hover': { bgcolor: isActive ? 'rgba(33,150,243,0.28)' : 'rgba(255,255,255,0.1)' },
        flexShrink: 0,
      }}
    >
      {isRenaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onFocus={e => e.target.select()}
          onBlur={onConfirmRename}
          onKeyDown={e => {
            if (e.key === 'Enter')  onConfirmRename();
            if (e.key === 'Escape') onCancelRename();
          }}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'white', fontSize: '0.72rem', fontWeight: 700,
            width: '100%', minWidth: 0,
          }}
        />
      ) : (
        <Typography
          variant="caption"
          onDoubleClick={e => { e.stopPropagation(); onStartRename(); }}
          sx={{
            fontWeight: isActive ? 700 : 500,
            color: isActive ? 'primary.light' : 'rgba(255,255,255,0.55)',
            fontSize: '0.72rem', lineHeight: 1.3, userSelect: 'none',
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {tactic.name}
        </Typography>
      )}
      {canDelete && (
        <Box
          onClick={e => { e.stopPropagation(); onDelete(); }}
          sx={{
            width: 18, height: 18, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', cursor: 'pointer',
            color: 'rgba(255,255,255,0.35)', fontSize: '0.9rem', lineHeight: 1,
            '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.12)' },
          }}
        >
          ×
        </Box>
      )}
    </Box>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TacticsBarProps {
  tactics: TacticEntry[];
  activeTacticId: string;
  renamingId: string | null;
  renameValue: string;
  vertical?: boolean;
  /** Used only in vertical mode: opens the preset picker */
  onLoadPreset?: (preset: TacticPreset) => void;
  /** Used only in vertical mode: current tactic data for saving presets */
  activeTactic?: TacticEntry;
  /** Hides editing controls (new tactic, presets) */
  presentationMode?: boolean;

  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onStartRename: (id: string, currentName: string) => void;
  onRenameChange: (v: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TacticsBar: React.FC<TacticsBarProps> = ({
  tactics, activeTacticId, renamingId, renameValue, vertical = false,
  onLoadPreset, activeTactic, presentationMode = false,
  onSelect, onNew, onDelete,
  onStartRename, onRenameChange, onConfirmRename, onCancelRename,
}) => {
  const [presetAnchor, setPresetAnchor] = useState<Element | null>(null);

  // ── Vertical sidebar mode (right panel) ──────────────────────────────────
  if (vertical) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', py: 0.75 }}>
        <Typography variant="caption" sx={{
          color: 'rgba(255,255,255,0.3)', fontWeight: 700,
          fontSize: '0.6rem', letterSpacing: 2, px: 1.5, mb: 0.5, flexShrink: 0, display: 'block',
        }}>
          TAKTIKEN
        </Typography>

        <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5, px: 0.75 }}>
          {tactics.map(tactic => (
            <TacticItem
              key={tactic.id}
              tactic={tactic}
              isActive={tactic.id === activeTacticId}
              isRenaming={renamingId === tactic.id}
              renameValue={renameValue}
              canDelete={!presentationMode && tactics.length > 1}
              onSelect={() => onSelect(tactic.id)}
              onStartRename={presentationMode ? () => undefined : () => onStartRename(tactic.id, tactic.name)}
              onRenameChange={onRenameChange}
              onConfirmRename={onConfirmRename}
              onCancelRename={onCancelRename}
              onDelete={() => onDelete(tactic.id)}
            />
          ))}
        </Box>

        {/* Add tactic button – hidden in presentation mode */}
        {!presentationMode && (
        <Box
          onClick={onNew}
          sx={{
            mx: 0.75, mt: 0.5, px: 1, py: 0.65, flexShrink: 0,
            bgcolor: 'transparent',
            border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px',
            cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
            fontSize: '0.72rem', textAlign: 'center', transition: 'all 0.15s',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.4)' },
          }}
        >
          + Neue Taktik
        </Box>
        )}

        {/* Preset picker button – hidden in presentation mode, only when handler is provided */}
        {!presentationMode && onLoadPreset && (
          <>
            <Box sx={{ mx: 0.75, mt: 0.25, borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }} />
            <Tooltip title="Taktik-Vorlagen laden / speichern" placement="left" arrow>
              <Box
                onClick={e => setPresetAnchor(e.currentTarget)}
                sx={{
                  mx: 0.75, mb: 0.5, px: 1, py: 0.65, flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  bgcolor: presetAnchor ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${presetAnchor ? 'rgba(250,204,21,0.45)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '8px', cursor: 'pointer',
                  color: presetAnchor ? '#facc15' : 'rgba(255,255,255,0.4)',
                  fontSize: '0.72rem', transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'rgba(250,204,21,0.1)', color: '#facc15', borderColor: 'rgba(250,204,21,0.4)' },
                }}
              >
                <BookmarksIcon sx={{ fontSize: 15 }} />
                Vorlagen
              </Box>
            </Tooltip>
            <PresetPicker
              anchorEl={presetAnchor}
              onClose={() => setPresetAnchor(null)}
              onLoadPreset={preset => { onLoadPreset(preset); setPresetAnchor(null); }}
              currentTacticData={activeTactic}
            />
          </>
        )}
      </Box>
    );
  }

  // ── Horizontal tab bar (default) ─────────────────────────────────────────
  return (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 0.75,
    px: 1.5, py: 0.5,
    bgcolor: 'rgba(0,0,0,0.2)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0, overflowX: 'auto',
  }}>
    <Typography variant="caption" sx={{
      color: 'rgba(255,255,255,0.3)', fontWeight: 700,
      fontSize: '0.6rem', letterSpacing: 2, flexShrink: 0,
    }}>
      TAKTIKEN
    </Typography>

    {tactics.map(tactic => {
      const isActive = tactic.id === activeTacticId;
      return (
        <Box
          key={tactic.id}
          onClick={() => onSelect(tactic.id)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1, py: { xs: 0.75, md: 0.3 },
            minHeight: { xs: 40, md: 'auto' },
            bgcolor: isActive ? 'rgba(33,150,243,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isActive ? 'rgba(33,150,243,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '12px', cursor: 'pointer', flexShrink: 0,
            transition: 'all 0.15s',
            '&:hover': {
              bgcolor: isActive ? 'rgba(33,150,243,0.28)' : 'rgba(255,255,255,0.1)',
            },
          }}
        >
          {renamingId === tactic.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => onRenameChange(e.target.value)}
              onBlur={onConfirmRename}
              onKeyDown={e => {
                if (e.key === 'Enter')  onConfirmRename();
                if (e.key === 'Escape') onCancelRename();
              }}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'white', fontSize: '0.72rem', fontWeight: 700,
                width: `${Math.max(6, renameValue.length + 1)}ch`,
              }}
            />
          ) : (
            <Typography
              variant="caption"
              onDoubleClick={e => {
                e.stopPropagation();
                onStartRename(tactic.id, tactic.name);
              }}
              sx={{
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'primary.light' : 'rgba(255,255,255,0.55)',
                fontSize: '0.72rem', lineHeight: 1, userSelect: 'none',
              }}
            >
              {tactic.name}
            </Typography>
          )}

          {/* Delete button – hidden when only one tactic remains */}
          {tactics.length > 1 && (
            <Box
              onClick={e => { e.stopPropagation(); onDelete(tactic.id); }}
              sx={{
                width: { xs: 24, md: 14 }, height: { xs: 24, md: 14 },
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)', fontSize: '0.9rem', lineHeight: 1,
                '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.12)' },
              }}
            >
              ×
            </Box>
          )}
        </Box>
      );
    })}

    {/* Add tactic button */}
    <Box
      onClick={onNew}
      sx={{
        display: 'flex', alignItems: 'center', px: 0.9, py: { xs: 0.75, md: 0.3 },
        minHeight: { xs: 40, md: 'auto' },
        bgcolor: 'transparent',
        border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '12px',
        cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
        fontSize: '0.72rem', flexShrink: 0, transition: 'all 0.15s',
        '&:hover': {
          bgcolor: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.8)',
          borderColor: 'rgba(255,255,255,0.4)',
        },
      }}
    >
      + Neue Taktik
    </Box>
  </Box>
  );
};
