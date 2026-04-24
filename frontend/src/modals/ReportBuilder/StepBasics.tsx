import React from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Chip,
  Checkbox,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { ReportBuilderState } from './types';

interface StepBasicsProps {
  state: ReportBuilderState;
}

export const StepBasics: React.FC<StepBasicsProps> = ({ state }) => {
  const { currentReport, setCurrentReport, builderData, isAdmin, activeStep } = state;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <TextField
          fullWidth
          label="Report Name *"
          value={currentReport.name}
          onChange={(e) => setCurrentReport(prev => ({ ...prev, name: e.target.value }))}
          placeholder="z.B. Torschüsse pro Spieltag"
          InputLabelProps={{ shrink: true }}
          helperText={!currentReport.name ? 'Pflichtfeld' : undefined}
          error={!currentReport.name && activeStep > 0}
        />
        <Tooltip title="Der Name wird im Dashboard-Widget, in der Berichtsübersicht und bei der Widget-Auswahl angezeigt. Wähle einen aussagekräftigen Namen." placement="top-end">
          <InfoOutlinedIcon fontSize="small" sx={{ mt: 1.75, color: 'text.secondary', flexShrink: 0, cursor: 'default' }} />
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <TextField
          fullWidth
          label="Beschreibung"
          value={currentReport.description}
          onChange={(e) => setCurrentReport(prev => ({ ...prev, description: e.target.value }))}
          multiline
          rows={2}
          placeholder="Kurze Beschreibung des Reports (optional)"
        />
        <Tooltip title="Optionale Notiz für dich selbst – z.B. Zweck des Reports, Zielgruppe oder besondere Filtereinstellungen. Wird in der Übersicht angezeigt." placement="top-end">
          <InfoOutlinedIcon fontSize="small" sx={{ mt: 1.75, color: 'text.secondary', flexShrink: 0, cursor: 'default' }} />
        </Tooltip>
      </Box>

      {/* Presets */}
      {builderData?.presets && builderData.presets.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography variant="subtitle2">
              Schnellstart — Vorlage wählen
            </Typography>
            <Tooltip title="Vorkonfigurierte Einstellungen für häufige Auswertungen. Ein Klick übernimmt alle Felder – du kannst sie danach noch beliebig anpassen." placement="top">
              <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default' }} />
            </Tooltip>
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap">
            {builderData.presets.map((p: any) => (
              <Chip
                key={p.key}
                label={p.label}
                onClick={() => setCurrentReport(prev => ({ ...prev, config: { ...prev.config, ...p.config } }))}
                variant="outlined"
                clickable
                sx={{ fontSize: '0.85rem' }}
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Template Checkbox für SuperAdmin */}
      {isAdmin && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={currentReport.isTemplate || false}
                onChange={(e) => setCurrentReport(prev => ({ ...prev, isTemplate: e.target.checked }))}
              />
            }
            label="Als Template verfügbar machen"
          />
          <Tooltip title="Template-Reports sind für alle Nutzer sichtbar und können als Ausgangspunkt für eigene Berichte genutzt werden. Bei Änderungen durch einen Nutzer wird automatisch eine persönliche Kopie angelegt." placement="top-end">
            <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default', flexShrink: 0 }} />
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};
