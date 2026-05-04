import React, { useMemo } from 'react';
import {
  Box,
  Chip,
  Typography,
  Checkbox,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { ReportBuilderState } from './types';
import { TemplateGrid } from './TemplateGrid';
import { TEMPLATE_META, findMatchingTemplateKey } from './templateMeta';

interface StepBasicsProps {
  state: ReportBuilderState;
}

export const StepBasics: React.FC<StepBasicsProps> = ({ state }) => {
  const { currentReport, setCurrentReport, builderData, isAdmin } = state;

  const matchedTemplateKey = useMemo(
    () => findMatchingTemplateKey(currentReport.config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentReport.config.diagramType, currentReport.config.xField, currentReport.config.yField],
  );
  const matchedTemplate = matchedTemplateKey ? TEMPLATE_META[matchedTemplateKey] : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

      {/* Presets */}
      {builderData && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2">Schnellstart — Vorlage wählen</Typography>
            {matchedTemplate && (
              <Chip
                size="small"
                icon={<CheckCircleOutlineIcon />}
                label={`${matchedTemplate.emoji} ${matchedTemplate.title}`}
                color="primary"
                variant="outlined"
              />
            )}
            <Tooltip title="Vorkonfigurierte Einstellungen für häufige Auswertungen. Ein Klick übernimmt alle Felder – du kannst sie danach noch beliebig anpassen." placement="top">
              <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default' }} />
            </Tooltip>
          </Box>
          <TemplateGrid
            builderData={builderData}
            selectedKey={matchedTemplateKey ?? undefined}
            maxHeight="none"
            onSelect={(tpl) => {
              setCurrentReport(prev => ({
                ...prev,
                // Vorlage-Titel als Name merken — wird beim Speichern als Vorschlag angezeigt
                name: tpl.title,
                config: {
                  ...prev.config,
                  ...tpl.resolvedConfig,
                  filters: { ...tpl.resolvedConfig.filters, ...prev.config.filters },
                },
              }));
            }}
          />
        </Box>
      )}
    </Box>
  );
};
