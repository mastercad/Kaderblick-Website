import React from 'react';
import { Box } from '@mui/material';
import { getZoneColor } from './helpers';

// ─── Template shape ────────────────────────────────────────────────────────────

export interface TemplatePlayer {
  position: string;
  x: number;
  y: number;
}

export interface FormationTemplate {
  code: string;
  label: string;
  description: string;
  players: TemplatePlayer[];
}

// ─── Football formation presets ────────────────────────────────────────────────
// LANDSCAPE half-pitch (matches fussballfeld_haelfte.jpg, 1357×960 px):
//   x = 0  → LEFT touchline
//   x = 100 → RIGHT touchline  (x=50 = lateral center / middle of field width)
//   y = 0  → TOP of image = centre line (Mittellinie) — attackers live here
//   y = 100 → BOTTOM of image = own goal line (Torlinie) — goalkeeper lives here

export const FOOTBALL_TEMPLATES: FormationTemplate[] = [
  {
    code: '4-4-2', label: '4-4-2', description: 'Klassisch & ausgewogen',
    players: [
      { position: 'TW',  x: 50, y: 88 },
      { position: 'RV',  x: 82, y: 68 }, { position: 'IV',  x: 62, y: 70 }, { position: 'IV',  x: 38, y: 70 }, { position: 'LV',  x: 18, y: 68 },
      { position: 'RM',  x: 80, y: 45 }, { position: 'ZM',  x: 60, y: 42 }, { position: 'ZM',  x: 40, y: 42 }, { position: 'LM',  x: 20, y: 45 },
      { position: 'ST',  x: 62, y: 14 }, { position: 'ST',  x: 38, y: 14 },
    ],
  },
  {
    code: '4-3-3', label: '4-3-3', description: 'Offensiv & pressingintensiv',
    players: [
      { position: 'TW',  x: 50, y: 88 },
      { position: 'RV',  x: 80, y: 68 }, { position: 'IV',  x: 62, y: 70 }, { position: 'IV',  x: 38, y: 70 }, { position: 'LV',  x: 20, y: 68 },
      { position: 'ZM',  x: 65, y: 46 }, { position: 'ZM',  x: 50, y: 42 }, { position: 'ZM',  x: 35, y: 46 },
      { position: 'RA',  x: 75, y: 16 }, { position: 'ST',  x: 50, y: 11 }, { position: 'LA',  x: 25, y: 16 },
    ],
  },
  {
    code: '4-2-3-1', label: '4-2-3-1', description: 'Defensiv stabil mit spielstarkem Mittelfeld',
    players: [
      { position: 'TW',  x: 50, y: 88 },
      { position: 'RV',  x: 80, y: 68 }, { position: 'IV',  x: 62, y: 70 }, { position: 'IV',  x: 38, y: 70 }, { position: 'LV',  x: 20, y: 68 },
      { position: 'DM',  x: 62, y: 56 }, { position: 'DM',  x: 38, y: 56 },
      { position: 'RA',  x: 77, y: 33 }, { position: 'ZOM', x: 50, y: 30 }, { position: 'LA',  x: 23, y: 33 },
      { position: 'ST',  x: 50, y: 11 },
    ],
  },
  {
    code: '3-5-2', label: '3-5-2', description: 'Breite Flügel, starkes Mittelfeld',
    players: [
      { position: 'TW',  x: 50, y: 88 },
      { position: 'IV',  x: 70, y: 70 }, { position: 'IV',  x: 50, y: 72 }, { position: 'IV',  x: 30, y: 70 },
      { position: 'RF',  x: 85, y: 46 }, { position: 'ZM',  x: 67, y: 42 }, { position: 'ZM',  x: 50, y: 40 }, { position: 'ZM',  x: 33, y: 42 }, { position: 'LF',  x: 15, y: 46 },
      { position: 'ST',  x: 62, y: 14 }, { position: 'ST',  x: 38, y: 14 },
    ],
  },
  {
    code: '5-3-2', label: '5-3-2', description: 'Defensiv mit schnellem Umschaltspiel',
    players: [
      { position: 'TW',  x: 50, y: 88 },
      { position: 'RF',  x: 83, y: 65 }, { position: 'IV',  x: 68, y: 70 }, { position: 'IV',  x: 50, y: 72 }, { position: 'IV',  x: 32, y: 70 }, { position: 'LF',  x: 17, y: 65 },
      { position: 'ZM',  x: 65, y: 43 }, { position: 'ZM',  x: 50, y: 40 }, { position: 'ZM',  x: 35, y: 43 },
      { position: 'ST',  x: 62, y: 14 }, { position: 'ST',  x: 38, y: 14 },
    ],
  },
  {
    code: '4-1-4-1', label: '4-1-4-1', description: 'Kompakt & pressingfähig',
    players: [
      { position: 'TW',  x: 50, y: 88 },
      { position: 'RV',  x: 80, y: 68 }, { position: 'IV',  x: 62, y: 70 }, { position: 'IV',  x: 38, y: 70 }, { position: 'LV',  x: 20, y: 68 },
      { position: 'DM',  x: 50, y: 56 },
      { position: 'RM',  x: 80, y: 35 }, { position: 'ZM',  x: 60, y: 32 }, { position: 'ZM',  x: 40, y: 32 }, { position: 'LM',  x: 20, y: 35 },
      { position: 'ST',  x: 50, y: 11 },
    ],
  },
];

// ─── MiniField: landscape half-pitch preview ──────────────────────────────────
// Matches image orientation: goal at BOTTOM, centre line at TOP.

interface MiniFieldProps {
  players: TemplatePlayer[];
}

export const MiniField: React.FC<MiniFieldProps> = ({ players }) => (
  <Box sx={{
    width: '100%',
    aspectRatio: '1357 / 960',
    maxHeight: 150,
    backgroundImage: 'url(/images/formation/fussballfeld_haelfte.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    bgcolor: '#2a5c27',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {players.map((p, i) => (
      <Box key={i} sx={{
        position: 'absolute',
        left: `${p.x}%`,
        top: `${p.y}%`,
        width: 6,
        height: 6,
        bgcolor: getZoneColor(p.y),
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        border: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
      }} />
    ))}
  </Box>
);
