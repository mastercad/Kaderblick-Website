import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Chip,
  ListSubheader,
  Divider,
  Switch,
  Tooltip,
  IconButton,
  Alert,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { ReportBuilderState, FieldOption } from './types';
import { DIAGRAM_TYPES } from './types';

/** Mini SVG preview + short use-case hint for each chart type, used in the mobile card grid. */
const DIAGRAM_TYPE_META: Record<string, { svg: React.ReactNode; desc: string }> = {
  bar: {
    desc: 'Vergleich',
    svg: (
      <svg viewBox="0 0 40 32" width={40} height={32} fill="currentColor">
        <rect x="3" y="14" width="9" height="16" rx="1" opacity={0.55}/>
        <rect x="15.5" y="6" width="9" height="24" rx="1"/>
        <rect x="28" y="10" width="9" height="20" rx="1" opacity={0.75}/>
      </svg>
    ),
  },
  line: {
    desc: 'Zeitverlauf',
    svg: (
      <svg viewBox="0 0 40 32" width={40} height={32} fill="currentColor" stroke="currentColor">
        <polyline points="2,24 10,14 20,22 30,8 38,16" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {([{cx:2,cy:24},{cx:10,cy:14},{cx:20,cy:22},{cx:30,cy:8},{cx:38,cy:16}] as {cx:number;cy:number}[]).map((p,i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r="2.5" stroke="none"/>
        ))}
      </svg>
    ),
  },
  area: {
    desc: 'Trend',
    svg: (
      <svg viewBox="0 0 40 32" width={40} height={32} fill="currentColor" stroke="currentColor">
        <polygon points="2,30 2,24 10,14 20,22 30,8 38,16 38,30" opacity={0.25} stroke="none"/>
        <polyline points="2,24 10,14 20,22 30,8 38,16" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  stackedarea: {
    desc: 'Gestapelt',
    svg: (
      <svg viewBox="0 0 40 32" width={40} height={32} fill="currentColor" stroke="currentColor">
        <polygon points="2,30 2,20 10,16 20,18 30,12 38,14 38,30" opacity={0.45} stroke="none"/>
        <polygon points="2,20 2,12 10,8 20,10 30,6 38,8 38,14 30,12 20,18 10,16" opacity={0.25} stroke="none"/>
        <polyline points="2,20 10,16 20,18 30,12 38,14" fill="none" strokeWidth="2" strokeLinecap="round"/>
        <polyline points="2,12 10,8 20,10 30,6 38,8" fill="none" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  scatter: {
    desc: 'Korrelation',
    svg: (
      <svg viewBox="0 0 40 32" width={40} height={32} fill="currentColor">
        <circle cx="8" cy="23" r="3"/><circle cx="14" cy="10" r="3"/>
        <circle cx="22" cy="26" r="3"/><circle cx="28" cy="15" r="3"/>
        <circle cx="36" cy="8" r="3"/><circle cx="11" cy="28" r="2"/>
        <circle cx="32" cy="22" r="2"/>
      </svg>
    ),
  },
  pie: {
    desc: 'Anteile',
    svg: (
      // 3 equal sectors (120° each), center (20,16), r=13
      // Points: 0°→(33,16)  120°→(13.5,27.3)  240°→(13.5,4.7)
      <svg viewBox="0 0 40 32" width={40} height={32} fill="currentColor">
        <path d="M20,16 L33,16 A13,13 0 0,1 13.5,27.3 Z"/>
        <path d="M20,16 L13.5,27.3 A13,13 0 0,1 13.5,4.7 Z" opacity={0.6}/>
        <path d="M20,16 L13.5,4.7 A13,13 0 0,1 33,16 Z" opacity={0.35}/>
      </svg>
    ),
  },
  doughnut: {
    desc: 'Anteile',
    svg: (
      // Thick ring (r=11, strokeWidth=7 → outer≈14.5, inner≈7.5)
      // strokeDasharray "21 2" repeats 3× over circumference≈69 ⇒ 3 equal segments
      <svg viewBox="0 0 40 32" width={40} height={32} fill="none" stroke="currentColor">
        <circle cx="20" cy="16" r="11" strokeWidth="7" strokeDasharray="21 2" transform="rotate(-90 20 16)"/>
      </svg>
    ),
  },
  radar: {
    desc: 'Profil',
    svg: (
      <svg viewBox="0 0 40 32" width={40} height={32} fill="currentColor" stroke="currentColor">
        <polygon points="20,2 34,10 34,22 20,30 6,22 6,10" fill="none" strokeWidth="1.5"/>
        <polygon points="20,7.2 29.6,12.8 29.6,20.8 20,25.6 10.4,20.8 10.4,12.8" fill="none" strokeWidth="0.8" opacity={0.5}/>
        <line x1="20" y1="2" x2="20" y2="30" strokeWidth="0.8" opacity={0.5}/>
        <line x1="6" y1="10" x2="34" y2="22" strokeWidth="0.8" opacity={0.5}/>
        <line x1="6" y1="22" x2="34" y2="10" strokeWidth="0.8" opacity={0.5}/>
        <polygon points="20,5 31,13 28,22 15,26 8,18 11,9" fillOpacity={0.3} strokeWidth="1.5"/>
      </svg>
    ),
  },
  radaroverlay: {
    desc: 'Vergleich',
    svg: (
      <svg viewBox="0 0 40 32" width={40} height={32} fill="currentColor" stroke="currentColor">
        <polygon points="20,2 34,10 34,22 20,30 6,22 6,10" fill="none" strokeWidth="1.5"/>
        <line x1="20" y1="2" x2="20" y2="30" strokeWidth="0.8" opacity={0.5}/>
        <line x1="6" y1="10" x2="34" y2="22" strokeWidth="0.8" opacity={0.5}/>
        <line x1="6" y1="22" x2="34" y2="10" strokeWidth="0.8" opacity={0.5}/>
        <polygon points="20,5 31,13 28,22 15,26 8,18 11,9" fillOpacity={0.3} strokeWidth="1.5"/>
        <polygon points="20,7 29,14 27,21 17,25 9,19 12,10" fillOpacity={0.2} strokeWidth="1.5" strokeDasharray="2 1.5"/>
      </svg>
    ),
  },
  faceted: {
    desc: 'Panels',
    svg: (
      <svg viewBox="0 0 40 32" width={40} height={32} fill="currentColor" stroke="currentColor">
        <rect x="1" y="1" width="17" height="13" rx="1" fill="none" strokeWidth="1"/>
        <rect x="3" y="8" width="3" height="5" opacity={0.5} stroke="none"/>
        <rect x="7" y="5" width="3" height="8" stroke="none"/>
        <rect x="11" y="7" width="3" height="6" opacity={0.75} stroke="none"/>
        <rect x="22" y="1" width="17" height="13" rx="1" fill="none" strokeWidth="1"/>
        <rect x="24" y="6" width="3" height="7" opacity={0.5} stroke="none"/>
        <rect x="28" y="4" width="3" height="9" stroke="none"/>
        <rect x="32" y="7" width="3" height="6" opacity={0.75} stroke="none"/>
        <rect x="1" y="17" width="17" height="13" rx="1" fill="none" strokeWidth="1"/>
        <rect x="3" y="24" width="3" height="5" opacity={0.5} stroke="none"/>
        <rect x="7" y="21" width="3" height="8" stroke="none"/>
        <rect x="11" y="23" width="3" height="6" opacity={0.75} stroke="none"/>
        <rect x="22" y="17" width="17" height="13" rx="1" fill="none" strokeWidth="1"/>
        <rect x="24" y="21" width="3" height="8" opacity={0.5} stroke="none"/>
        <rect x="28" y="19" width="3" height="10" stroke="none"/>
        <rect x="32" y="22" width="3" height="7" opacity={0.75} stroke="none"/>
      </svg>
    ),
  },
  pitchheatmap: {
    desc: 'Heatmap',
    svg: (
      <svg viewBox="0 0 40 32" width={40} height={32}>
        <ellipse cx="20" cy="16" rx="18" ry="13" fill="currentColor" opacity={0.1}/>
        <ellipse cx="20" cy="16" rx="13" ry="9" fill="currentColor" opacity={0.2}/>
        <ellipse cx="20" cy="16" rx="7" ry="5" fill="currentColor" opacity={0.5}/>
        <ellipse cx="20" cy="16" rx="3" ry="2" fill="currentColor" opacity={0.85}/>
        <ellipse cx="20" cy="16" rx="18" ry="13" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="2" y1="16" x2="38" y2="16" stroke="currentColor" strokeWidth="0.8" opacity={0.4}/>
        <rect x="15" y="11" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="0.8" opacity={0.4}/>
      </svg>
    ),
  },
  boxplot: {
    desc: 'Verteilung',
    svg: (
      <svg viewBox="0 0 40 32" width={40} height={32} fill="currentColor" stroke="currentColor">
        <line x1="7" y1="16" x2="13" y2="16" strokeWidth="1.5"/>
        <line x1="7" y1="12" x2="7" y2="20" strokeWidth="1.5"/>
        <rect x="13" y="10" width="14" height="12" fillOpacity={0.2} strokeWidth="1.5"/>
        <line x1="20" y1="10" x2="20" y2="22" strokeWidth="2.5"/>
        <line x1="27" y1="16" x2="33" y2="16" strokeWidth="1.5"/>
        <line x1="33" y1="12" x2="33" y2="20" strokeWidth="1.5"/>
      </svg>
    ),
  },
};

/** Reusable tooltip info icon for field explanations */
const Tip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip title={text} placement="top-end">
    <InfoOutlinedIcon fontSize="small" sx={{ mt: 1.75, color: 'text.secondary', flexShrink: 0, cursor: 'default' }} />
  </Tooltip>
);

interface StepDataChartProps {
  state: ReportBuilderState;
}

/** Classify fields into dimensions (grouping) vs metrics (counting) for structured dropdowns */
function splitFields(fields: FieldOption[]) {
  const dimensions = fields.filter(f => !f.isMetricCandidate);
  const metrics = fields.filter(f => f.isMetricCandidate);
  return { dimensions, metrics };
}

/**
 * Derive which diagram types are most suitable given the current x/y axis selection.
 * This gives non-technical users a clear recommendation without limiting their choice.
 */
function getRecommendedDiagramTypes(
  xField: string | undefined,
  yField: string | undefined,
  fields: FieldOption[],
): Set<string> {
  const rec = new Set<string>();
  if (!xField || !yField) return rec;

  const TIME_DIM_KEYS = ['month', 'matchday', 'date', 'season', 'year', 'week', 'day'];
  const xIsTime = TIME_DIM_KEYS.some(k => xField.toLowerCase().includes(k));
  const xMeta = fields.find(f => f.key === xField);
  const yMeta = fields.find(f => f.key === yField);
  const xIsMetric = !!xMeta?.isMetricCandidate;
  const yIsMetric = !!yMeta?.isMetricCandidate;

  if (xIsTime) {
    // Time on X → trend charts work best
    rec.add('line');
    rec.add('area');
    rec.add('stackedarea');
    rec.add('bar');
  } else if (xIsMetric && yIsMetric) {
    // Both axes are numeric → scatter / correlation
    rec.add('scatter');
    rec.add('bar');
  } else if (!xIsMetric && yIsMetric) {
    // Categorical X + metric Y → the most common case
    rec.add('bar');
    if (['player', 'team'].includes(xField)) {
      // Entity-level comparisons also work well as radar/profile
      rec.add('radar');
      rec.add('radaroverlay');
    }
    // Pie/Donut useful for share comparisons (few groups)
    rec.add('pie');
    rec.add('doughnut');
  } else {
    rec.add('bar');
  }
  return rec;
}

export const StepDataChart: React.FC<StepDataChartProps> = ({ state }) => {
  const {
    currentReport,
    setCurrentReport,
    availableFields,
    builderData,
    isMobile,
    diag,
    handleConfigChange,
  } = state;

  const { dimensions: backendDimensions, metrics } = splitFields(availableFields);

  // 'player' is a special entity-level dimension used by the wizard but not returned
  // in the backend's event-field list — inject it so the Select always has a valid option.
  const PLAYER_DIMENSION: FieldOption = { key: 'player', label: 'Spieler', isMetricCandidate: false };
  const dimensions = backendDimensions.some(f => f.key === 'player')
    ? backendDimensions
    : [PLAYER_DIMENSION, ...backendDimensions];

  const xField = currentReport.config.xField;
  const yField = currentReport.config.yField;
  const xIsMetric = !!xField && metrics.some(f => f.key === xField);
  // A dimension on Y is valid (e.g. count of event types per player) — only warn when a metric ends up on X
  const axesSwapped = xIsMetric;

  // Recommended diagram types for the current axis configuration
  const recommendedTypeKeys = getRecommendedDiagramTypes(xField, yField, availableFields);
  const recDiagramTypes = DIAGRAM_TYPES.filter(dt => recommendedTypeKeys.has(dt.value));
  const otherDiagramTypes = DIAGRAM_TYPES.filter(dt => !recommendedTypeKeys.has(dt.value));

  const isBoxplot = currentReport.config.diagramType === 'boxplot';
  // Y-field is non-numeric (a dimension) — invalid for boxplot
  const yIsDimension = !!yField && dimensions.some(f => f.key === yField) && !metrics.some(f => f.key === yField);
  const boxplotYInvalid = isBoxplot && yField && yIsDimension;

  /** Hebt ausgewählte Werte in Select-Feldern fett + primärfarbe hervor */
  const selSx = (val: string | undefined | null) =>
    val ? { '& .MuiSelect-select': { fontWeight: 600, color: 'primary.main' } } : undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Orientation hint for new users */}
      {!xField && !yField && (
        <Alert severity="info" sx={{ mb: 0.5 }}>
          <strong>So funktioniert es:</strong> Die <strong>X-Achse</strong> ist immer eine Dimension (z.B. Spieler, Monat, Team) — sie bestimmt die Beschriftungen. Die <strong>Y-Achse</strong> ist eine Metrik (z.B. Tore, Vorlagen) — sie bestimmt die Höhe der Balken.
        </Alert>
      )}

      {/* Boxplot explanation — shown as soon as boxplot is selected */}
      {isBoxplot && !boxplotYInvalid && (
        <Alert severity="info" sx={{ mb: 0.5 }}>
          <strong>Boxplot erklärt:</strong> Zeigt die <em>Streuung</em> einer Metrik über alle Spiele.
          Jeder Balken steht für die Verteilung der Y-Werte über alle Spieltage —
          der Strich in der Mitte ist der Median, die Box umfasst den mittleren Bereich (Q1–Q3).{' '}
          <strong>Sinnvolle Konfigurationen:</strong> X = Spieler + Y = Tore zeigt, ob ein Spieler
          gleichmäßig trifft oder nur in einzelnen Spielen. X = Monat + Y = Tore zeigt die
          monatliche Streuung der Tore.
        </Alert>
      )}

      {/* Boxplot mis-configuration: Y is a non-numeric dimension */}
      {boxplotYInvalid && (
        <Alert
          severity="warning"
          action={
            <Tooltip title="Y-Achse auf eine Metrik ändern">
              <IconButton
                size="small"
                color="inherit"
                onClick={() => handleConfigChange('yField', metrics[0]?.key ?? '')}
              >
                <SwapVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        >
          <strong>Boxplot braucht eine Metrik auf der Y-Achse.</strong>{' '}
          „{availableFields.find(f => f.key === yField)?.label ?? yField}" ist eine Kategorie (kein Zahlenwert) —
          ein Boxplot darüber ist nicht aussagekräftig.
          Wähle stattdessen eine Metrik wie <em>Tore</em>, <em>Schüsse</em> oder <em>Vorlagen</em>.
        </Alert>
      )}

      {/* Axes-swapped warning */}
      {axesSwapped && (
        <Alert
          severity="warning"
          action={
            <Tooltip title="X- und Y-Achse tauschen">
              <IconButton
                size="small"
                color="inherit"
                onClick={() =>
                  setCurrentReport(prev => ({
                    ...prev,
                    config: { ...prev.config, xField: prev.config.yField, yField: prev.config.xField },
                  }))
                }
              >
                <SwapVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        >
          {(() => {
            const xLabel = availableFields.find(f => f.key === xField)?.label ?? xField;
            // Only fires when xIsMetric — simplify to single message
            return <><strong>„{xLabel}"</strong> ist eine Metrik — auf der X-Achse erscheint dadurch nur „Unbekannt" als Beschriftung. Verschiebe <strong>{xLabel}</strong> auf die Y-Achse.</>;
          })()}
        </Alert>
      )}

      {/* X-Axis — typically a dimension (Spieler, Team, Monat...) */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <FormControl fullWidth>
          <InputLabel>X-Achse (Gruppierung) *</InputLabel>
          <Select
            value={currentReport.config.xField ?? ''}
            onChange={(e) => {
              const newX = e.target.value;
              handleConfigChange('xField', newX);
              // Auto-clear groupBy when it would conflict with the new xField
              const curGroupBy = Array.isArray(currentReport.config.groupBy)
                ? (currentReport.config.groupBy[0] || '')
                : (currentReport.config.groupBy || '');
              if (curGroupBy && curGroupBy === newX) {
                handleConfigChange('groupBy', '');
              }
            }}
            label="X-Achse (Gruppierung) *"
            sx={selSx(currentReport.config.xField)}
          >
            <MenuItem value="">
              <em>— Feld wählen —</em>
            </MenuItem>
            {dimensions.length > 0 && [
              <Divider key="div-dim" />,
              <ListSubheader key="hdr-dim" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '32px', color: 'text.primary', bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>Gruppierung</ListSubheader>,
            ]}
            {dimensions
              .filter(f => f.key !== currentReport.config.yField)
              .map(f => (
                <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
            ))}
            {metrics.length > 0 && [
              <Divider key="div-met" />,
              <ListSubheader key="hdr-met" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '32px', color: 'text.primary', bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>Metriken</ListSubheader>,
            ]}
            {metrics
              .filter(f => f.key !== currentReport.config.yField)
              .map(f => (
                <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tip text="Die X-Achse bestimmt die Beschriftung und Gruppierung der Balken/Punkte – z.B. Spieler, Monat oder Team. Jeder eindeutige Wert dieses Feldes ergibt eine eigene Kategorie." />
      </Box>

      {/* Swap X ↔ Y axes — compact button between the two selects, only shown when no swapped-warning is active */}
      {!axesSwapped && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', my: -0.5 }}>
          <Tooltip title="X- und Y-Achse tauschen">
            <IconButton
              size="small"
              onClick={() =>
                setCurrentReport(prev => ({
                  ...prev,
                  config: { ...prev.config, xField: prev.config.yField, yField: prev.config.xField },
                }))
              }
              sx={{ color: 'primary.main' }}
            >
              <SwapVertIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Y-Axis — multi-select for chart types that support multiple metrics */}
      {(['radar', 'radaroverlay', 'bar', 'line'].includes(diag ?? '')) ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Autocomplete
            multiple
            fullWidth
            options={availableFields.filter(f => f.key !== currentReport.config.xField)}
            groupBy={(opt) => opt.isMetricCandidate ? 'Metriken' : 'Gruppierung'}
            getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label}
            getOptionDisabled={(opt) => {
              const selected = availableFields.filter(f => (currentReport.config.metrics || []).includes(f.key));
              const hasMetric = selected.some(f => f.isMetricCandidate);
              const hasDimension = selected.some(f => !f.isMetricCandidate);
              // Keine Mischung: wenn Metrik(en) gewählt → Dimensionen sperren; wenn Dimension gewählt → Metriken + weitere Dimensionen sperren
              if (opt.isMetricCandidate) return hasDimension;
              return hasMetric || hasDimension;
            }}
            value={availableFields.filter((f) => (currentReport.config.metrics || []).includes(f.key))}
            onChange={(_, newValue) => {
              const keys = newValue.map((v: any) => v.key);
              handleConfigChange('metrics', keys);
              // keep yField in sync so backend fallback paths work
              if (keys.length > 0) handleConfigChange('yField', keys[0]);
            }}
            renderTags={(value: any[], getTagProps) =>
              value.map((option: any, index: number) => (
                <Chip label={option.label} {...getTagProps({ index })} key={option.key} size="small" />
              ))
            }
            renderGroup={(params) => (
              <li key={params.key}>
                <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
                  <ListSubheader sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '32px', color: 'text.primary', bgcolor: 'background.paper', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
                    {params.group}
                  </ListSubheader>
                  {params.children}
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Y-Achse (Wert) *" placeholder="Feld(er) wählen…" />
            )}
            ListboxProps={{ sx: { pt: 0 } }}
          />
          <Tip text="Wähle ein oder mehrere Felder. Bei Radar wird jedes zur Achse; bei Balken-/Liniendiagrammen entsteht pro Feld eine eigene Dataset-Gruppe." />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Y-Achse (Wert) *</InputLabel>
            <Select
              value={currentReport.config.yField ?? ''}
              onChange={(e) => handleConfigChange('yField', e.target.value)}
              label="Y-Achse (Wert) *"
              sx={selSx(currentReport.config.yField)}
            >
              <MenuItem value="">
                <em>— Feld wählen —</em>
              </MenuItem>
              {metrics.length > 0 && [
                <Divider key="div-met" />,
                <ListSubheader key="hdr-met" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '32px', color: 'text.primary', bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>Metriken</ListSubheader>,
              ]}
              {metrics
                .filter(f => f.key !== currentReport.config.xField)
                .map(f => (
                  <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
              ))}
              {/* For boxplot, hide dimension options on Y-axis — only numeric metrics make sense */}
              {!isBoxplot && dimensions.length > 0 && [
                <Divider key="div-dim" />,
                <ListSubheader key="hdr-dim" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '32px', color: 'text.primary', bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>Gruppierung</ListSubheader>,
              ]}
              {!isBoxplot && dimensions
                .filter(f => f.key !== currentReport.config.xField)
                .map(f => (
                  <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tip text="Die Y-Achse bestimmt den gemessenen Wert – z.B. Anzahl Tore, Vorlagen oder Schüsse. Die Höhe jedes Balkens entspricht diesem Wert." />
        </Box>
      )}

      {/* Gruppierung */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <FormControl fullWidth>
          <InputLabel>Gruppierung (optional)</InputLabel>
          <Select
            value={(() => {
              const v = Array.isArray(currentReport.config.groupBy) ? (currentReport.config.groupBy[0] || '') : (currentReport.config.groupBy || '');
              // Guard: groupBy must not equal xField (that dimension is filtered out of options)
              return v === currentReport.config.xField ? '' : v;
            })()}
            onChange={(e) => handleConfigChange('groupBy', e.target.value)}
            label="Gruppierung (optional)"
            sx={selSx((() => {
              const v = Array.isArray(currentReport.config.groupBy) ? (currentReport.config.groupBy[0] || '') : (currentReport.config.groupBy || '');
              return v === currentReport.config.xField ? '' : v;
            })())}
          >
            <MenuItem value="">Keine Gruppierung</MenuItem>
            {dimensions
              .filter(f => f.key !== currentReport.config.xField)
              .map((field) => (
                <MenuItem key={field.key} value={field.key}>{field.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tip text="Fügt eine zweite Unterscheidungsdimension hinzu – z.B. unterschiedlich eingefärbte Balken pro Ereignistyp für jeden Spieler. Ohne Gruppierung gibt es nur eine Datenreihe." />
      </Box>

      {/* Chart Type — card grid on mobile, select on desktop */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">Chart-Typ</Typography>
          <Tooltip title="Bestimmt die Visualisierungsform: Balken für Vergleiche, Linie/Fläche für Zeitverläufe, Kreis/Donut für Anteile, Radar für mehrere Metriken gleichzeitig, Heatmap für Positionsdaten." placement="top">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default' }} />
          </Tooltip>
        </Box>
        {isMobile ? (
          (() => {
            const hasRec = recDiagramTypes.length > 0;
            const renderCard = (dt: typeof DIAGRAM_TYPES[number], dimmed = false) => {
              const isSelected = currentReport.config.diagramType === dt.value;
              const meta = DIAGRAM_TYPE_META[dt.value];
              return (
                <Paper
                  key={dt.value}
                  variant={isSelected ? 'elevation' : 'outlined'}
                  onClick={() => handleConfigChange('diagramType', dt.value)}
                  sx={{
                    p: 1,
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                    opacity: dimmed && !isSelected ? 0.5 : 1,
                    bgcolor: isSelected ? 'primary.main' : 'background.paper',
                    color: isSelected ? 'primary.contrastText' : 'text.primary',
                    border: 2,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    transition: 'all 0.15s',
                    '&:active': { transform: 'scale(0.97)' },
                  }}
                >
                  {meta && (
                    <Box sx={{ color: isSelected ? 'primary.contrastText' : dimmed ? 'text.disabled' : 'primary.main', lineHeight: 0 }}>
                      {meta.svg}
                    </Box>
                  )}
                  <Typography
                    variant="caption"
                    fontWeight={isSelected ? 600 : 400}
                    display="block"
                    sx={{ lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
                  >
                    {dt.label}
                  </Typography>
                  {meta && (
                    <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem', opacity: 0.7, lineHeight: 1 }}>
                      {meta.desc}
                    </Typography>
                  )}
                </Paper>
              );
            };

            if (!hasRec) {
              return (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 1 }}>
                  {DIAGRAM_TYPES.map(dt => renderCard(dt))}
                </Box>
              );
            }

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Empfohlen für deine Einstellungen
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 1 }}>
                    {recDiagramTypes.map(dt => renderCard(dt))}
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.75, fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Weitere Typen
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 1 }}>
                    {otherDiagramTypes.map(dt => renderCard(dt, true))}
                  </Box>
                </Box>
              </Box>
            );
          })()
        ) : (
          <FormControl fullWidth>
            <InputLabel>Chart-Typ</InputLabel>
            <Select
              value={currentReport.config.diagramType ?? 'bar'}
              onChange={(e) => handleConfigChange('diagramType', e.target.value)}
              label="Chart-Typ"
              renderValue={(value) => {
                const dt = DIAGRAM_TYPES.find(d => d.value === value);
                const meta = DIAGRAM_TYPE_META[value as string];
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {meta && (
                      <Box sx={{ flexShrink: 0, color: 'primary.main', lineHeight: 0, '& svg': { width: 28, height: 22 } }}>
                        {meta.svg}
                      </Box>
                    )}
                    <Typography variant="body2" component="span">
                      {dt?.label ?? String(value)}
                    </Typography>
                  </Box>
                );
              }}
            >
              {/* Empfohlene Typen — abhängig von der X-/Y-Achsen-Konfiguration */}
              {recDiagramTypes.length > 0 && (
                <ListSubheader sx={{ lineHeight: '28px', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  Empfohlen für diese Konfiguration
                </ListSubheader>
              )}
              {recDiagramTypes.map(dt => {
                const meta = DIAGRAM_TYPE_META[dt.value];
                return (
                  <MenuItem key={dt.value} value={dt.value} sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      {meta && (
                        <Box sx={{ flexShrink: 0, color: 'primary.main', lineHeight: 0 }}>
                          {meta.svg}
                        </Box>
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600}>{dt.label}</Typography>
                        {meta && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {meta.desc}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </MenuItem>
                );
              })}

              {/* Weitere Typen */}
              {otherDiagramTypes.length > 0 && recDiagramTypes.length > 0 && (
                <ListSubheader sx={{ lineHeight: '28px', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  Weitere Typen
                </ListSubheader>
              )}
              {otherDiagramTypes.map(dt => {
                const meta = DIAGRAM_TYPE_META[dt.value];
                return (
                  <MenuItem key={dt.value} value={dt.value} sx={{ py: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      {meta && (
                        <Box sx={{ flexShrink: 0, color: 'text.disabled', lineHeight: 0 }}>
                          {meta.svg}
                        </Box>
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" color="text.secondary">{dt.label}</Typography>
                        {meta && (
                          <Typography variant="caption" color="text.disabled" display="block">
                            {meta.desc}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </MenuItem>
                );
              })}

              {/* Keine Empfehlung: alle Typen gleichwertig anzeigen */}
              {recDiagramTypes.length === 0 && DIAGRAM_TYPES.map(dt => {
                const meta = DIAGRAM_TYPE_META[dt.value];
                return (
                  <MenuItem key={dt.value} value={dt.value} sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      {meta && (
                        <Box sx={{ flexShrink: 0, color: 'primary.main', lineHeight: 0 }}>
                          {meta.svg}
                        </Box>
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2">{dt.label}</Typography>
                        {meta && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {meta.desc}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Facet-By selector for faceted charts */}
      {diag === 'faceted' && (
      <>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Facette (Panel-Aufteilung) *</InputLabel>
            <Select
              value={currentReport.config.facetBy || ''}
              onChange={(e) => handleConfigChange('facetBy', e.target.value)}
              label="Facette (Panel-Aufteilung) *"
            >
              <MenuItem value="">
                <em>— Feld wählen —</em>
              </MenuItem>
              {dimensions
                .filter(f => f.key !== currentReport.config.xField && f.key !== currentReport.config.groupBy)
                .map(f => (
                  <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Pro Wert dieses Feldes wird ein eigenes Panel/Diagramm erstellt.
            </Typography>
          </FormControl>
          <Tip text="Die Facette bestimmt, nach welchem Merkmal die Daten in separate Panels aufgeteilt werden – z.B. ein Panel pro Platztyp oder ein Panel pro Spieltyp." />
        </Box>

        {/* Sub-chart type for faceted panels */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Panel-Diagrammtyp</InputLabel>
            <Select
              value={currentReport.config.facetSubType || 'bar'}
              onChange={(e) => handleConfigChange('facetSubType', e.target.value)}
              label="Panel-Diagrammtyp"
            >
              <MenuItem value="bar">Balken</MenuItem>
              <MenuItem value="radar">Radar</MenuItem>
              <MenuItem value="area">Fläche (Area)</MenuItem>
              <MenuItem value="line">Linie</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Bestimmt den Chart-Typ innerhalb jedes Panels.
            </Typography>
          </FormControl>
          <Tip text="Wähle den Diagrammtyp, der innerhalb jedes einzelnen Panels angezeigt wird – unabhängig vom äußeren Facetten-Rahmen." />
        </Box>

        {/* Transpose toggle: swap axes ↔ datasets */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FormControlLabel
            control={
              <Switch
                checked={currentReport.config.facetTranspose ?? (currentReport.config.facetSubType === 'radar')}
                onChange={(e) => handleConfigChange('facetTranspose', e.target.checked)}
              />
            }
            label="Achsen tauschen (Spieler ↔ Ereignistypen)"
          />
          <Tooltip title="Aktiviert: Spieler werden als Overlay-Datasets dargestellt, Ereignistypen als Achsenbeschriftungen. Deaktiviert: umgekehrt. Besonders nützlich bei Radar-Panels." placement="top-end">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default', flexShrink: 0 }} />
          </Tooltip>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
          An: Spieler als Overlay-Layers, Ereignistypen als Achsen. Aus: umgekehrt.
        </Typography>

        {/* Layout selector for faceted panels */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Darstellung / Layout</InputLabel>
            <Select
              value={currentReport.config.facetLayout || 'grid'}
              onChange={(e) => handleConfigChange('facetLayout', e.target.value)}
              label="Darstellung / Layout"
            >
              <MenuItem value="grid">Raster (Panels nebeneinander)</MenuItem>
              <MenuItem value="vertical">Untereinander (volle Breite)</MenuItem>
              <MenuItem value="interactive">Interaktiv (Umschalten per Klick)</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Raster: kompakter Überblick. Untereinander: größere Panels. Interaktiv: ein Panel mit Umschalter.
            </Typography>
          </FormControl>
          <Tip text="Raster: alle Panels nebeneinander für schnellen Überblick. Untereinander: maximale Breite pro Panel für Details. Interaktiv: platzsparend, Panels per Tab umschaltbar." />
        </Box>
      </>
      )}

    </Box>
  );
};
