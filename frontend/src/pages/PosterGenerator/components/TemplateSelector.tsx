import React from 'react';
import {
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  useTheme,
} from '@mui/material';
import { POSTER_TEMPLATES } from '../types/poster';
import type { PosterTemplateId, PosterFormat } from '../types/poster';

interface Props {
  selectedTemplate: PosterTemplateId;
  selectedFormat: PosterFormat;
  onTemplateChange: (id: PosterTemplateId) => void;
  onFormatChange: (format: PosterFormat) => void;
}

const FORMAT_LABELS: Record<PosterFormat, string> = {
  '1:1':  'Quadrat (1:1)',
  '9:16': 'Story (9:16)',
  '16:9': 'Breit (16:9)',
};

/**
 * Lets the user pick a poster template (game announcement, result, …)
 * and the output format (square, story, wide).
 */
export function TemplateSelector({
  selectedTemplate,
  selectedFormat,
  onTemplateChange,
  onFormatChange,
}: Props) {
  const theme = useTheme();

  const currentTemplate = POSTER_TEMPLATES.find(t => t.id === selectedTemplate);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
        Vorlage
      </Typography>
      <ToggleButtonGroup
        exclusive
        value={selectedTemplate}
        onChange={(_, val) => { if (val) onTemplateChange(val as PosterTemplateId); }}
        sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}
      >
        {POSTER_TEMPLATES.map(t => (
          <ToggleButton
            key={t.id}
            value={t.id}
            sx={{
              flexDirection: 'column',
              px: 2,
              py: 1.5,
              borderRadius: '8px !important',
              border: `1px solid ${theme.palette.divider} !important`,
              '&.Mui-selected': {
                background: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                borderColor: `${theme.palette.primary.main} !important`,
              },
            }}
          >
            <Typography variant="caption" sx={{
              fontWeight: 700
            }}>{t.label}</Typography>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {currentTemplate && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            Format
          </Typography>

          <ToggleButtonGroup
            exclusive
            value={selectedFormat}
            onChange={(_, val) => { if (val) onFormatChange(val as PosterFormat); }}
            sx={{ flexWrap: 'wrap', gap: 1 }}
          >
            {currentTemplate.supportedFormats.map(fmt => (
              <ToggleButton
                key={fmt}
                value={fmt}
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: '8px !important',
                  border: `1px solid ${theme.palette.divider} !important`,
                  '&.Mui-selected': {
                    background: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    borderColor: `${theme.palette.primary.main} !important`,
                  },
                }}
              >
                <Typography variant="caption">{FORMAT_LABELS[fmt]}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </>
      )}
    </Box>
  );
}
