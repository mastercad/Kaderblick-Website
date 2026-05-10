import { COLOR_NAME_TO_HEX } from './colorNameToHex';

const HEX_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/** Separators used between color names (e.g. "Rot/Weiß", "Schwarz-Gelb", "Blau, Weiß") */
const SEPARATORS = /[/\-,|]+/;

function resolveColor(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (HEX_PATTERN.test(trimmed)) return trimmed;
  return COLOR_NAME_TO_HEX[trimmed] ?? null;
}

export interface ClubColors {
  primary: string;
  secondary: string;
}

const FALLBACK: ClubColors = { primary: '#1a1a2e', secondary: '#e94560' };

/**
 * Parses a free-text club color string (as stored in fussball.de imports)
 * into a structured primary/secondary hex pair.
 *
 * Examples:
 *   "Rot/Weiß"      → { primary: '#CC0000', secondary: '#FFFFFF' }
 *   "Schwarz-Gelb"  → { primary: '#111111', secondary: '#FFD700' }
 *   "Blau"          → { primary: '#0044CC', secondary: '#FFFFFF' }
 *   null / ""       → fallback dark theme
 */
export function parseClubColors(clubColors: string | null | undefined): ClubColors {
  if (!clubColors || !clubColors.trim()) return FALLBACK;

  const parts = clubColors
    .split(SEPARATORS)
    .map(p => p.trim())
    .filter(Boolean);

  const primary   = parts[0] ? resolveColor(parts[0]) : null;
  const secondary = parts[1] ? resolveColor(parts[1]) : null;

  if (!primary) return FALLBACK;

  return {
    primary,
    secondary: secondary ?? '#FFFFFF',
  };
}
