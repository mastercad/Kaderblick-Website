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
          <Tooltip title="Statt einzelner Spieltags-Werte siehst du den Durchschnitt aus mehreren aufeinanderfolgenden Spielen – Ausreißer werden abgeschwächt und der Trend wird klarer sichtbar.">
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
            <Tooltip title="Geglättet: Weiche Farbflächen zeigen, wo die meisten Ereignisse stattfanden. Klassisch: Das Spielfeld wird in Kacheln aufgeteilt – jede zeigt wie viele Ereignisse dort auftraten. Beides: beide Ansichten gleichzeitig." placement="top-end">
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
            <Tooltip title="Zeigt Ereignisse an ihrer genauen Position auf dem Spielfeld – nur verfügbar wenn Positionsdaten zu den Ereignissen gespeichert wurden." placement="top-end">
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
          <Tooltip title="Nützlich wenn Spieler sehr unterschiedlich viele Einsätze hatten: Die Werte werden auf einer gemeinsamen Skala (0–100 %) dargestellt, damit ein Spieler mit wenigen Spielen fair mit einem aus vielen verglichen werden kann." placement="top-end">
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
          <Tooltip title="Zeigt eine Erklärung welche Farbe zu welchem Spieler, Team oder Wert gehört – hilfreich wenn mehrere Linien oder Balkengruppen im Diagramm zu sehen sind." placement="top-end">
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
          <Tooltip title="Schreibt den genauen Zahlenwert direkt an jeden Balken oder Punkt – so siehst du die Werte auf einen Blick, ohne mit der Maus darüber fahren zu müssen." placement="top-end">
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
            <Tooltip title="Dreht das Diagramm so, dass die Balken von links nach rechts verlaufen statt nach oben. Praktisch wenn die Beschriftungen (z.B. Spielernamen) sehr lang sind." placement="top-end">
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
          <Tooltip title="Versteckt Spieler, Monate oder Kategorien, für die kein einziger Wert vorliegt – so bleibt das Diagramm übersichtlich und zeigt nur das Wesentliche." placement="top-end">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default', flexShrink: 0 }} />
          </Tooltip>
        </Box>
      </Paper>

    </Box>
  );
};
