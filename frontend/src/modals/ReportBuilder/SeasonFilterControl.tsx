import React, { useState } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// ── Season helpers ────────────────────────────────────────────────────────────

/** Returns the start-year of the season that is currently running. */
function currentSeasonYear(): number {
  const now = new Date();
  // Seasons run Aug–Jun. Month >= 7 (August) means we're in the new season.
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Formats a season start-year as "2024/25". */
export function formatSeason(year: number): string {
  return `${year}/${String(year + 1).slice(2)}`;
}

/**
 * Derives the list of season start-years that have actual data.
 * Falls back to [currentSeasonYear()] when no dates are available.
 */
function getAvailableSeasonYears(availableDates: string[]): number[] {
  if (!availableDates.length) return [currentSeasonYear()];
  const parseYear = (d: string) => {
    const [y, m] = d.split('-').map(Number);
    return m >= 8 ? y : y - 1;
  };
  const first = parseYear(availableDates[0]);
  const last  = parseYear(availableDates[availableDates.length - 1]);
  const result: number[] = [];
  for (let y = first; y <= last; y++) result.push(y);
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Mode = 'none' | 'fixed' | 'current' | 'range';

export interface SeasonFilterChanges {
  seasonFilter?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

interface SeasonFilterControlProps {
  /** Current value of filters.seasonFilter ('current' | '2024' | undefined). */
  seasonFilter: string | undefined;
  /** Current dateFrom filter value (used for range mode and legacy compat). */
  dateFrom?: string;
  /** Current dateTo filter value (used for range mode). */
  dateTo?: string;
  /** Available game dates from builderData — used to enumerate past seasons. */
  availableDates: string[];
  /** When true, renders the mode-switcher vertically (fits narrow screens). */
  isMobile?: boolean;
  /**
   * Called whenever the filter selection changes.
   * Always contains all three keys so the caller can reset stale values.
   */
  onChange: (changes: SeasonFilterChanges) => void;
}

export const SeasonFilterControl: React.FC<SeasonFilterControlProps> = ({
  seasonFilter,
  dateFrom,
  dateTo,
  availableDates,
  isMobile = false,
  onChange,
}) => {
  // Track range mode intent separately: when the user clicks 'Zeitraum' but
  // hasn't filled any date yet, both dateFrom and dateTo are still empty.
  const [rangeIntent, setRangeIntent] = useState(false);

  // ── Derive current mode ──────────────────────────────────────────────────
  const derivedMode: Mode = (() => {
    if (seasonFilter === 'current') return 'current';
    if (seasonFilter && /^\d{4}$/.test(seasonFilter)) return 'fixed';
    // Legacy backward-compat: old reports stored dateFrom without dateTo
    if (!seasonFilter && dateFrom && !dateTo && /\d{4}-0[78]-01/.test(dateFrom)) return 'fixed';
    // Custom range: either both dates, or just one of them
    if (!seasonFilter && (dateFrom || dateTo)) return 'range';
    return 'none';
  })();

  const mode: Mode = (derivedMode === 'none' && rangeIntent) ? 'range' : derivedMode;

  // ── Season year for 'fixed' mode ─────────────────────────────────────────
  const seasons = getAvailableSeasonYears(availableDates);
  const curYear = currentSeasonYear();

  const fixedYear = (() => {
    if (seasonFilter && /^\d{4}$/.test(seasonFilter)) return Number(seasonFilter);
    // Legacy: extract year from dateFrom
    if (dateFrom) {
      const m = dateFrom.match(/^(\d{4})-0[78]-01$/);
      if (m) return Number(m[1]);
    }
    // Default to current season when switching to fixed mode
    return curYear;
  })();

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleModeChange = (_: React.MouseEvent, newMode: string | null) => {
    if (newMode === null) return; // ToggleButtonGroup: prevent full deselect
    setRangeIntent(newMode === 'range');
    if (newMode === 'none') {
      onChange({ seasonFilter: null, dateFrom: null, dateTo: null });
    } else if (newMode === 'current') {
      onChange({ seasonFilter: 'current', dateFrom: null, dateTo: null });
    } else if (newMode === 'fixed') {
      onChange({ seasonFilter: String(seasons.includes(fixedYear) ? fixedYear : curYear), dateFrom: null, dateTo: null });
    } else {
      // 'range' — clear seasonFilter and existing season dates; keep any existing dateFrom/dateTo
      onChange({ seasonFilter: null, dateFrom: dateFrom ?? null, dateTo: dateTo ?? null });
    }
  };

  const navigate = (dir: -1 | 1) => {
    const idx = seasons.indexOf(fixedYear);
    const next = seasons[idx + dir];
    if (next !== undefined) onChange({ seasonFilter: String(next), dateFrom: null, dateTo: null });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle2">Saison / Zeitraum</Typography>
        <Tooltip
          title="Saison: schränkt die Auswertung auf eine Spielzeit ein. 'Aktuelle Saison' bleibt auch nach dem Saisonwechsel aktuell. Zeitraum: freier Von-Bis-Bereich, z.B. für Mehrjahresvergleiche."
          placement="top"
        >
          <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default' }} />
        </Tooltip>
      </Box>

      {/* Column layout so caption/inputs always appear below the button row */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={handleModeChange}
          orientation={isMobile ? 'vertical' : 'horizontal'}
          sx={isMobile ? { width: '100%' } : { flexWrap: 'wrap' }}
        >
          <ToggleButton value="none" sx={{ fontSize: '0.75rem', ...(isMobile && { justifyContent: 'flex-start' }) }}>Alle Daten</ToggleButton>
          <ToggleButton value="current" sx={{ fontSize: '0.75rem', ...(isMobile && { justifyContent: 'flex-start' }) }}>🔄 Aktuelle Saison</ToggleButton>
          <ToggleButton value="fixed" sx={{ fontSize: '0.75rem', ...(isMobile && { justifyContent: 'flex-start' }) }}>Bestimmte Saison</ToggleButton>
          <ToggleButton value="range" sx={{ fontSize: '0.75rem', ...(isMobile && { justifyContent: 'flex-start' }) }}>Zeitraum</ToggleButton>
        </ToggleButtonGroup>

        {/* Current season: info caption */}
        {mode === 'current' && (
          <Typography variant="body2" color="text.secondary">
            Immer die laufende Saison ({formatSeason(curYear)}) — wird nach dem Saisonwechsel automatisch aktualisiert.
          </Typography>
        )}

        {/* Fixed season: arrow navigation */}
        {mode === 'fixed' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => navigate(-1)}
              disabled={seasons.indexOf(fixedYear) <= 0}
              aria-label="Vorherige Saison"
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="body2" fontWeight={600} sx={{ minWidth: 88, textAlign: 'center' }}>
              Saison {formatSeason(fixedYear)}
            </Typography>
            <IconButton
              size="small"
              onClick={() => navigate(1)}
              disabled={seasons.indexOf(fixedYear) >= seasons.length - 1}
              aria-label="Nächste Saison"
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        )}

        {/* Custom date range */}
        {mode === 'range' && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField
              label="Von"
              type="date"
              size="small"
              value={dateFrom ?? ''}
              onChange={(e) => onChange({ seasonFilter: null, dateFrom: e.target.value || null, dateTo: dateTo ?? null })}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1, minWidth: 150 }}
            />
            <TextField
              label="Bis"
              type="date"
              size="small"
              value={dateTo ?? ''}
              onChange={(e) => onChange({ seasonFilter: null, dateFrom: dateFrom ?? null, dateTo: e.target.value || null })}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1, minWidth: 150 }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
