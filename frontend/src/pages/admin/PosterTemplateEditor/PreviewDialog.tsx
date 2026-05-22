import React from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DynamicPosterRenderer } from '../../PosterGenerator/DynamicPosterRenderer';
import { FORMAT_DIMS } from '../../PosterGenerator/types/posterTemplate';
import type { PosterFormat } from '../../PosterGenerator/types/posterTemplate';
import { buildMockPayload } from './helpers';
import type { EditorTemplate } from './types';

const PREVIEW_WIDTH = 420;

const FORMAT_LABELS: Record<PosterFormat, string> = {
  '1:1':  'Quadrat (1:1)',
  '9:16': 'Story (9:16)',
  '16:9': 'Quer (16:9)',
};

export interface PreviewDialogProps {
  open: boolean;
  onClose: () => void;
  template: EditorTemplate;
  activeFormat: PosterFormat;
}

export default function PreviewDialog({ open, onClose, template, activeFormat }: PreviewDialogProps) {
  const [format, setFormat] = React.useState<PosterFormat>(activeFormat);

  // Wenn der Dialog geöffnet wird, das aktuell aktive Format als Start nehmen
  React.useEffect(() => {
    if (open) setFormat(activeFormat);
  }, [open, activeFormat]);

  const supportedFormats = template.supportedFormats.length > 0
    ? template.supportedFormats
    : ['1:1' as PosterFormat];

  const safeFormat = supportedFormats.includes(format) ? format : supportedFormats[0];
  const dims = FORMAT_DIMS[safeFormat] ?? FORMAT_DIMS['1:1'];
  const scale = PREVIEW_WIDTH / dims.width;
  const previewHeight = Math.round(dims.height * scale);

  const mockPayload = buildMockPayload(template.posterType);

  // DynamicPosterRenderer erwartet PosterTemplateDefinition (mit id/createdAt/updatedAt)
  const fullTemplate = {
    ...template,
    id: 0,
    createdAt: '',
    updatedAt: '',
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" component="span" sx={{
          fontWeight: 700
        }}>
          Vorschau mit Beispieldaten
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="schließen">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        {supportedFormats.length > 1 && (
          <Box sx={{ mb: 2 }}>
            <ToggleButtonGroup
              value={safeFormat}
              exclusive
              onChange={(_, v) => { if (v) setFormat(v); }}
              size="small"
            >
              {supportedFormats.map(f => (
                <ToggleButton key={f} value={f} sx={{ fontSize: '0.75rem' }}>
                  {FORMAT_LABELS[f]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        <Box
          sx={{
            position: 'relative',
            background: '#0a0a14',
            borderRadius: 2,
            overflow: 'hidden',
            width: PREVIEW_WIDTH,
            height: previewHeight,
            mx: 'auto',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: dims.width,
              height: dims.height,
            }}
          >
            <DynamicPosterRenderer
              template={fullTemplate}
              payload={mockPayload}
              format={safeFormat}
              clubName="FC Musterstadt e.V."
            />
          </Box>
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            mt: 1.5,
            display: 'block',
            textAlign: 'center'
          }}>
          Platzhalter werden mit generischen Beispieldaten befüllt.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
