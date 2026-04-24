/**
 * MobileChartSummary — compact card shown on mobile instead of a full chart.
 *
 * Displays:
 *   - A mini sparkline (SVG polyline) for the first dataset
 *   - Key metrics: last value, min, max, average (where available)
 *   - A "Diagramm öffnen" button that triggers the parent fullscreen dialog
 *
 * Only rendered when the chart type supports it (line, area, bar, stackedarea).
 * All other types fall back directly to the fullscreen-only button.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

interface MobileChartSummaryProps {
  labels: string[];
  datasets: Array<{ label: string; data: (number | null)[]; [k: string]: any }>;
  diagramType: string;
  onOpenFullscreen: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function numericValues(data: (number | null)[]): number[] {
  return data.filter((v): v is number => typeof v === 'number' && isFinite(v));
}

function formatValue(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' M';
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + ' k';
  if (!Number.isInteger(v)) return v.toFixed(1);
  return String(v);
}

function trendIcon(values: number[]) {
  if (values.length < 2) return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
  const half = Math.max(1, Math.floor(values.length / 2));
  const first = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const last = values.slice(-half).reduce((a, b) => a + b, 0) / half;
  const delta = (last - first) / Math.max(1, Math.abs(first));
  if (delta > 0.05) return <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />;
  if (delta < -0.05) return <TrendingDownIcon fontSize="small" sx={{ color: 'error.main' }} />;
  return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
}

/**
 * Render a tiny polyline sparkline as an SVG.
 */
function Sparkline({
  values,
  color = '#1976d2',
  width = 120,
  height = 40,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pad = 3;
  const points = values
    .map((v, i) => {
      const x = pad + ((i / (values.length - 1)) * (width - 2 * pad));
      const y = pad + ((1 - (v - min) / range) * (height - 2 * pad));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <polygon
        points={`${pad},${height - pad} ${points} ${width - pad},${height - pad}`}
        fill="url(#sparkGrad)"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last-value dot */}
      {(() => {
        const lastPt = points.split(' ').at(-1)?.split(',');
        if (!lastPt) return null;
        return <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill={color} />;
      })()}
    </svg>
  );
}

// ── SUPPORTED types that can show metrics ────────────────────────────────────

const METRIC_TYPES = new Set(['bar', 'line', 'area', 'stackedarea']);

/**
 * Detect whether labels represent a temporal/sequential axis (dates, matchdays,
 * weeks, months, quarters, years) rather than independent categories (player names etc.).
 *
 * Checks a sample of labels; at least 2/3 must match a temporal pattern.
 */
function isTemporalLabels(labels: string[]): boolean {
  if (labels.length < 2) return false;
  const samples = [
    labels[0],
    labels[Math.floor(labels.length / 2)],
    labels[labels.length - 1],
  ];
  // Matches: DD.MM.YYYY, DD.MM, YYYY-MM-DD, MM/YYYY, "März 2024", "Spieltag 12",
  // "KW 42", "Q1 2025", plain 4-digit year, "Woche 3" etc.
  const temporal =
    /\d{1,2}[./]\d{1,2}([./]\d{2,4})?|^\d{4}[-/]\d{1,2}|\b(jan|feb|mär|apr|mai|jun|jul|aug|sep|okt|nov|dez|january|february|march|april|may|june|july|august|september|october|november|december)\b|\bQ[1-4]\b|\bKW\s*\d+|\bspiel(tag)?\s*\d+|\bwoche\s*\d+|\brunde\s*\d+|\b\d{4}\b/i;
  const matched = samples.filter(s => temporal.test(s)).length;
  return matched >= 2;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MobileChartSummary: React.FC<MobileChartSummaryProps> = ({
  labels,
  datasets,
  diagramType,
  onOpenFullscreen,
}) => {
  const supportsMetrics = METRIC_TYPES.has(diagramType);

  // Line / Area are always temporal.
  // Bar charts can be either: "goals per player" (categorical) or "goals per game" (temporal).
  // Detect via label content.
  const isTimeSeries =
    ['line', 'area', 'stackedarea'].includes(diagramType) ||
    (diagramType === 'bar' && isTemporalLabels(labels));

  const isCategorical = METRIC_TYPES.has(diagramType) && !isTimeSeries;

  const primary = datasets[0];
  const primaryValues = primary ? numericValues(primary.data as (number | null)[]) : [];

  const avgVal =
    primaryValues.length
      ? primaryValues.reduce((a, b) => a + b, 0) / primaryValues.length
      : undefined;

  // ── Time-series metrics ──
  // For temporal data the meaningful headline is the PEAK (max), not the last value.
  // "Last value" is often a recent low or incomplete period; peak is what users remember.
  const peakVal = primaryValues.length ? Math.max(...primaryValues) : undefined;
  const peakIdx =
    peakVal !== undefined
      ? (primary?.data as (number | null)[]).indexOf(peakVal)
      : -1;
  const peakLabel = peakIdx >= 0 ? labels[peakIdx] : undefined;

  // Last value is still shown as a secondary chip for line/area ("aktuell")
  const lastVal = primaryValues.at(-1);
  const lastLabel = labels.at(-1);

  // ── Categorical: top-3 ranking ──
  // Build (label, value) pairs sorted descending by value, take top 3.
  const TOP_N = 3;
  const top3: { label: string; value: number }[] = primaryValues
    .map((v, i) => ({ value: v, label: labels[i] ?? String(i + 1) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N);

  // Sparkline values:
  //   Time-series → chronological order
  //   Categorical → sorted descending (shows distribution "cliff")
  const sparklineValues = isTimeSeries
    ? primaryValues
    : [...primaryValues].sort((a, b) => b - a);

  const sparkColor =
    typeof primary?.borderColor === 'string' ? primary.borderColor :
    typeof primary?.backgroundColor === 'string' ? primary.backgroundColor :
    '#1976d2';

  const RANK_LABELS = ['1.', '2.', '3.'];

  if (!supportsMetrics) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          py: 3,
          px: 2,
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Auf Mobilgeräten nur im Vollbild verfügbar.
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<FullscreenIcon />}
          onClick={onOpenFullscreen}
        >
          Diagramm öffnen
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Header row ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>

        {/* Sparkline */}
        <Box sx={{ flexShrink: 0 }}>
          <Sparkline values={sparklineValues} color={sparkColor} width={100} height={44} />
        </Box>

        {isTimeSeries ? (
          /* Time-series: peak value + when */
          <Box sx={{ textAlign: 'right', flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
              {trendIcon(primaryValues)}
              <Typography variant="h5" fontWeight={700} lineHeight={1}>
                {peakVal !== undefined ? formatValue(peakVal) : '–'}
              </Typography>
            </Box>
            {peakLabel && (
              <Typography variant="caption" color="text.secondary">
                Höchstwert · {peakLabel}
              </Typography>
            )}
            {primary?.label && (
              <Typography variant="caption" color="text.disabled" fontStyle="italic" sx={{ display: 'block' }}>
                {primary.label}
              </Typography>
            )}
          </Box>
        ) : (
          /* Categorical: top-3 ranking list */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {top3.map((entry, i) => (
              <Box
                key={i}
                sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 0.5 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums', width: '1.4em' }}
                  >
                    {RANK_LABELS[i]}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {entry.label}
                  </Typography>
                </Box>
                <Typography variant="caption" fontWeight={700} sx={{ flexShrink: 0 }}>
                  {formatValue(entry.value)}
                </Typography>
              </Box>
            ))}
            {primary?.label && (
              <Typography variant="caption" color="text.disabled" fontStyle="italic" sx={{ mt: 0.25 }}>
                {primary.label}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* ── Chips ── */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', px: 0.5 }}>
        {isTimeSeries ? (
          <>
            {avgVal !== undefined && (
              <Chip label={`Ø ${formatValue(avgVal)}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
            )}
            {/* "Aktuell" – last period value, useful for trend context */}
            {lastVal !== undefined && lastVal !== peakVal && (
              <Chip label={`Aktuell: ${formatValue(lastVal)}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
            )}
            {primaryValues.length > 0 && (
              <Chip label={`${primaryValues.length} Einträge`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
            )}
          </>
        ) : (
          <>
            {avgVal !== undefined && (
              <Chip label={`Ø ${formatValue(avgVal)}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
            )}
            {primaryValues.length > 0 && (
              <Chip label={`${primaryValues.length} Einträge`} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
            )}
          </>
        )}
      </Box>

      {datasets.length > 1 && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
          + {datasets.length - 1} weitere{datasets.length - 1 === 1 ? ' Datenreihe' : ' Datenreihen'}
        </Typography>
      )}

      {/* ── Open fullscreen button ── */}
      <Box sx={{ px: 0.5 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FullscreenIcon />}
          onClick={onOpenFullscreen}
          fullWidth
          sx={{ textTransform: 'none', fontSize: '0.8rem' }}
        >
          Vollständiges Diagramm anzeigen
        </Button>
      </Box>
    </Box>
  );
};
