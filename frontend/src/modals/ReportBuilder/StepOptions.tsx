import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Slider,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Collapse,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { ReportBuilderState } from './types';

interface StepOptionsProps {
  state: ReportBuilderState;
}

export const StepOptions: React.FC<StepOptionsProps> = ({ state }) => {
  const {
    currentReport,
    setCurrentReport,
    isSuperAdmin,
    diag,
    maApplicable,
    handleConfigChange,
  } = state;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Moving Average */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <FormControlLabel
            control={
              <Checkbox
                checked={currentReport.config.movingAverage?.enabled || false}
                onChange={(e) =>
                  setCurrentReport(prev => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      movingAverage: {
                        ...(prev.config.movingAverage || { enabled: false, window: 3, method: 'mean' }),
                        enabled: e.target.checked,
                      },
                    },
                  }))
                }
                disabled={!maApplicable}
              />
            }
            label="Gleitender Durchschnitt"
          />
          <Tooltip title="Glättet die Serie über ein wählbares Fenster.">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </Tooltip>
        </Box>
        {!maApplicable && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
            Nicht für diesen Diagrammtyp verfügbar
          </Typography>
        )}

        <Collapse in={!!(currentReport.config.movingAverage?.enabled && maApplicable)}>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2, pl: 2 }}>
            <Box>
              <Typography variant="body2" gutterBottom>Fenster: {currentReport.config.movingAverage?.window || 3}</Typography>
              <Slider
                value={currentReport.config.movingAverage?.window || 3}
                min={1}
                max={21}
                step={1}
                onChange={(_, val) =>
                  setCurrentReport(prev => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      movingAverage: {
                        ...(prev.config.movingAverage || { enabled: true, window: 3 }),
                        window: val as number,
                      },
                    },
                  }))
                }
                valueLabelDisplay="auto"
              />
            </Box>
            <FormControl fullWidth size="small">
              <InputLabel>Zentralwert</InputLabel>
              <Select
                value={currentReport.config.movingAverage?.method || 'mean'}
                label="Zentralwert"
                onChange={(e) =>
                  setCurrentReport(prev => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      movingAverage: {
                        ...(prev.config.movingAverage || { enabled: true, window: 3, method: 'mean' }),
                        method: e.target.value as 'mean' | 'median',
                      },
                    },
                  }))
                }
              >
                <MenuItem value="mean">Mittelwert</MenuItem>
                <MenuItem value="median">Median</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Collapse>
      </Paper>

      {/* Heatmap options */}
      {diag === 'pitchheatmap' && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Heatmap-Optionen</Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Darstellung</InputLabel>
              <Select
                value={(currentReport.config as any).heatmapStyle || 'smoothed'}
                onChange={(e) => handleConfigChange('heatmapStyle', e.target.value)}
                label="Darstellung"
              >
                <MenuItem value="smoothed">Geglättet (Standard)</MenuItem>
                <MenuItem value="classic">Klassisch (Grid)</MenuItem>
                <MenuItem value="both">Beides</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Geglättet: Kernel-Dichte-Schätzung für weiche Farbverläufe. Klassisch: gleichmäßiges Gitter zeigt Zonen-Häufigkeit. Beides: beide Darstellungen überlagert." placement="top-end">
              <InfoOutlinedIcon fontSize="small" sx={{ mt: 1, color: 'text.secondary', cursor: 'default', flexShrink: 0 }} />
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!(currentReport.config as any).heatmapSpatial}
                  onChange={(e) =>
                    setCurrentReport(prev => ({
                      ...prev,
                      config: { ...prev.config, heatmapSpatial: e.target.checked },
                    }))
                  }
                />
              }
              label="Räumliche Heatmap (x/y)"
            />
            <Tooltip title="Verwendet die gespeicherten X/Y-Koordinaten der Ereignisse um eine positionsgenaue Spielfeldkarte zu zeichnen, statt eine Raster-Aggregation zu verwenden." placement="top-end">
              <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default', flexShrink: 0 }} />
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
            Versucht X/Y-Koordinaten für Events zu verwenden
          </Typography>
        </Paper>
      )}

      {/* Radar options */}
      {(diag === 'radar' || diag === 'radaroverlay') && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={(currentReport.config as any).radarNormalize === true}
                onChange={(e) =>
                  setCurrentReport(prev => ({
                    ...prev,
                    config: { ...prev.config, radarNormalize: e.target.checked },
                  }))
                }
              />
            }
            label="Pro Dataset normalisieren"
          />
          <Tooltip title="Skaliert jeden Datensatz unabhängig auf 0–100 %, sodass Spieler oder Teams mit unterschiedlichen Gesamtzahlen direkt verglichen werden können." placement="top-end">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default', flexShrink: 0 }} />
          </Tooltip>
        </Box>
      )}

      {/* Legend & Labels */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Anzeige</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={currentReport.config.showLegend ?? false}
                onChange={(e) => handleConfigChange('showLegend', e.target.checked)}
              />
            }
            label="Legende anzeigen"
          />
          <Tooltip title="Blendet eine Farblegende ein, die erklärt welche Farbe welchen Datensatz (z.B. welchen Spieler) repräsentiert." placement="top-end">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default', flexShrink: 0 }} />
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={currentReport.config.showLabels ?? false}
                onChange={(e) => handleConfigChange('showLabels', e.target.checked)}
              />
            }
            label="Datenlabels anzeigen"
          />
          <Tooltip title="Zeigt den genauen Zahlenwert direkt auf oder neben jedem Balken bzw. Punkt im Diagramm an – nützlich wenn genaue Werte ohne Hover erkennbar sein sollen." placement="top-end">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default', flexShrink: 0 }} />
          </Tooltip>
        </Box>
        {diag === 'bar' && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!(currentReport.config as any).horizontalBar}
                  onChange={(e) => handleConfigChange('horizontalBar', e.target.checked)}
                />
              }
              label="Horizontal anzeigen"
            />
            <Tooltip title="Dreht das Balkendiagramm – die Achsen werden getauscht, sodass die Balken waagrecht verlaufen. Nützlich bei langen Beschriftungen." placement="top-end">
              <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default', flexShrink: 0 }} />
            </Tooltip>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!(currentReport.config as any).hideEmpty}
                onChange={(e) => handleConfigChange('hideEmpty', e.target.checked)}
              />
            }
            label="Einträge ohne Wert ausblenden"
          />
          <Tooltip title="Blendet Beschriftungen und Datenpunkte aus, bei denen alle Datensätze den Wert 0, null oder leer haben – hält das Diagramm übersichtlicher." placement="top-end">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default', flexShrink: 0 }} />
          </Tooltip>
        </Box>
      </Paper>

      {/* DB aggregates (admin only) */}
      {isSuperAdmin && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!currentReport.config.use_db_aggregates}
                onChange={(e) => handleConfigChange('use_db_aggregates', e.target.checked)}
              />
            }
            label="DB-Aggregate (opt-in)"
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
            Berechnet Aggregation in der Datenbank statt in PHP
          </Typography>
        </Paper>
      )}
    </Box>
  );
};
