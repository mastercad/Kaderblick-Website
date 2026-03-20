// ─── TacticsBoard – status bar ────────────────────────────────────────────────
import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import type { Tool, DrawElement, OpponentToken } from './types';

// ─── Tool descriptions ────────────────────────────────────────────────────────

const TOOL_HINT: Record<Tool, string> = {
  pointer: 'Elemente antippen zum Auswählen → dann mit „Löschen" entfernen oder einfach verschieben',
  arrow:   'Passpfeil zeichnen – auf das Feld klicken/tippen und ziehen',
  run:     'Laufweg zeichnen – auf das Feld klicken/tippen und ziehen (gestrichelt)',
  zone:    'Bereich markieren – auf das Feld klicken/tippen und Radius ziehen',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StatusBarProps {
  tool: Tool;
  elements: DrawElement[];
  opponents: OpponentToken[];
  isBrowserFS: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StatusBar: React.FC<StatusBarProps> = ({
  tool, elements, opponents, isBrowserFS,
}) => (
  <Box sx={{
    px: 2, py: 0.6,
    display: 'flex', alignItems: 'center', gap: 1.5,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    bgcolor: 'rgba(0,0,0,0.3)', flexShrink: 0,
  }}>
    {/* Pulse indicator */}
    <Box sx={{
      width: 7, height: 7, borderRadius: '50%',
      bgcolor: '#69f0ae', boxShadow: '0 0 6px #69f0ae',
      animation: 'pulse 2s ease-in-out infinite',
      '@keyframes pulse': {
        '0%, 100%': { opacity: 1 },
        '50%':      { opacity: 0.35 },
      },
    }} />

    <Typography variant="caption"
      sx={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.68rem' }}>
      {TOOL_HINT[tool]}
    </Typography>

    <Box sx={{ flex: 1 }} />

    {opponents.length > 0 && (
      <Typography variant="caption"
        sx={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.65rem' }}>
        {opponents.length} Gegner
      </Typography>
    )}
    {elements.length > 0 && (
      <Typography variant="caption"
        sx={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.65rem' }}>
        · {elements.length} Zeichnung{elements.length !== 1 ? 'en' : ''}
      </Typography>
    )}
    {isBrowserFS && (
      <Chip label="● LIVE" size="small" sx={{
        bgcolor: 'rgba(244,67,54,0.2)', color: '#ff5252',
        border: '1px solid rgba(244,67,54,0.4)',
        fontWeight: 800, fontSize: '0.6rem', height: 18, letterSpacing: 1,
      }} />
    )}
  </Box>
);
