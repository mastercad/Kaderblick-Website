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

  const { dimensions, metrics } = splitFields(availableFields);

  const xField = currentReport.config.xField;
  const yField = currentReport.config.yField;
  const xIsMetric = !!xField && metrics.some(f => f.key === xField);
  // A dimension on Y is valid (e.g. count of event types per player) — only warn when a metric ends up on X
  const axesSwapped = xIsMetric;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Orientation hint for new users */}
      {!xField && !yField && (
        <Alert severity="info" sx={{ mb: 0.5 }}>
          <strong>So funktioniert es:</strong> Die <strong>X-Achse</strong> ist immer eine Dimension (z.B. Spieler, Monat, Team) — sie bestimmt die Beschriftungen. Die <strong>Y-Achse</strong> ist eine Metrik (z.B. Tore, Vorlagen) — sie bestimmt die Höhe der Balken.
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
            value={currentReport.config.xField}
            onChange={(e) => handleConfigChange('xField', e.target.value)}
            label="X-Achse (Gruppierung) *"
          >
            <MenuItem value="">
              <em>— Feld wählen —</em>
            </MenuItem>
            {dimensions.length > 0 && <ListSubheader>Gruppierung</ListSubheader>}
            {dimensions
              .filter(f => f.key !== currentReport.config.yField)
              .map(f => (
                <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
            ))}
            {metrics.length > 0 && <ListSubheader>Metriken</ListSubheader>}
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

      {/* Y-Axis — typically a metric (Tore, Assists, Karten...) */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <FormControl fullWidth>
          <InputLabel>Y-Achse (Wert) *</InputLabel>
          <Select
            value={currentReport.config.yField}
            onChange={(e) => handleConfigChange('yField', e.target.value)}
            label="Y-Achse (Wert) *"
          >
            <MenuItem value="">
              <em>— Feld wählen —</em>
            </MenuItem>
            {metrics.length > 0 && <ListSubheader>Metriken</ListSubheader>}
            {metrics
              .filter(f => f.key !== currentReport.config.xField)
              .map(f => (
                <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
            ))}
            {dimensions.length > 0 && <ListSubheader>Gruppierung</ListSubheader>}
            {dimensions
              .filter(f => f.key !== currentReport.config.xField)
              .map(f => (
                <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tip text="Die Y-Achse bestimmt den gemessenen Wert – z.B. Anzahl Tore, Vorlagen oder Schüsse. Die Höhe jedes Balkens entspricht diesem Wert." />
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
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 1,
            }}
          >
            {DIAGRAM_TYPES.map(dt => (
              <Paper
                key={dt.value}
                variant={currentReport.config.diagramType === dt.value ? 'elevation' : 'outlined'}
                onClick={() => handleConfigChange('diagramType', dt.value)}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  textAlign: 'center',
                  bgcolor: currentReport.config.diagramType === dt.value ? 'primary.main' : 'background.paper',
                  color: currentReport.config.diagramType === dt.value ? 'primary.contrastText' : 'text.primary',
                  border: currentReport.config.diagramType === dt.value ? 2 : 1,
                  borderColor: currentReport.config.diagramType === dt.value ? 'primary.main' : 'divider',
                  transition: 'all 0.15s',
                  '&:active': { transform: 'scale(0.97)' },
                }}
              >
                <Typography variant="body2" fontWeight={currentReport.config.diagramType === dt.value ? 600 : 400}>
                  {dt.label}
                </Typography>
              </Paper>
            ))}
          </Box>
        ) : (
          <FormControl fullWidth>
            <InputLabel>Chart Typ</InputLabel>
            <Select
              value={currentReport.config.diagramType}
              onChange={(e) => handleConfigChange('diagramType', e.target.value)}
              label="Chart Typ"
            >
              {DIAGRAM_TYPES.map(dt => (
                <MenuItem key={dt.value} value={dt.value}>{dt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Gruppierung */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <FormControl fullWidth>
          <InputLabel>Gruppierung (optional)</InputLabel>
          <Select
            value={Array.isArray(currentReport.config.groupBy) ? (currentReport.config.groupBy[0] || '') : (currentReport.config.groupBy || '')}
            onChange={(e) => handleConfigChange('groupBy', e.target.value)}
            label="Gruppierung (optional)"
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

      {/* Metrics selector for Radar charts */}
      {(diag === 'radar' || diag === 'radaroverlay') && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Autocomplete
            multiple
            fullWidth
            options={builderData?.metrics ?? []}
            getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label}
            value={(builderData?.metrics ?? []).filter((m) => (currentReport.config.metrics || []).includes(m.key))}
            onChange={(_, newValue) => handleConfigChange('metrics', newValue.map((v: any) => v.key))}
            renderTags={(value: any[], getTagProps) =>
              value.map((option: any, index: number) => (
                <Chip label={option.label} {...getTagProps({ index })} key={option.key} size="small" />
              ))
            }
            renderInput={(params) => (
              <TextField {...params} label="Metriken" placeholder="Metriken auswählen" />
            )}
          />
          <Tip text="Wähle die Kennzahlen, die als Achsen im Radar-Diagramm erscheinen sollen – z.B. Tore, Vorlagen und Schüsse. Jede Metrik wird zu einer Ecke/Achse des Radarnetzes." />
        </Box>
      )}
    </Box>
  );
};
