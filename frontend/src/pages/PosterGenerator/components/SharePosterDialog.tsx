import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DynamicPosterRenderer } from '../DynamicPosterRenderer';
import { ExportActions } from './ExportActions';
import { usePosterClub } from '../hooks/usePosterClub';
import { usePosterFonts } from '../hooks/usePosterFonts';
import { fetchPosterTemplates } from '../../../services/posterTemplateService';
import { parseClubColors } from '../utils/parseClubColors';
import type { PosterPayload, PosterFormat } from '../types/poster';
import type { PosterTemplateDefinition, PosterType } from '../types/posterTemplate';
import { FORMAT_DIMS } from '../types/posterTemplate';
import { getInitialPreviewWidth } from '../utils/previewWidth';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<PosterFormat, string> = {
  '1:1':  'Quadrat (1:1)',
  '9:16': 'Story (9:16)',
  '16:9': 'Quer (16:9)',
};

const PAYLOAD_TYPE_MAP: Record<PosterPayload['templateId'], PosterType> = {
  'game-announcement':  'game_announcement',
  'game-result':        'game_result',
  'event-announcement': 'event_announcement',
  'player-highlight':   'player_highlight',
};

// ─── Komponente ───────────────────────────────────────────────────────────────

export interface SharePosterDialogProps {
  open: boolean;
  onClose: () => void;
  payload: PosterPayload;
}

/**
 * Dialog zum Teilen und Exportieren von dynamischen Poster-Vorlagen.
 * Lädt Vorlagen aus der API und rendert sie mit echten Spieler-/Spieldaten.
 */
export function SharePosterDialog({ open, onClose, payload }: SharePosterDialogProps) {
  usePosterFonts();
  const posterRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(getInitialPreviewWidth);
  const { club, loading: clubLoading } = usePosterClub();

  const [templates, setTemplates]     = useState<PosterTemplateDefinition[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError]   = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [format, setFormat]           = useState<PosterFormat>('1:1');

  // Vorlagen laden
  const loadTemplates = useCallback(async () => {
    if (!open) return;
    setTemplatesLoading(true);
    setTemplatesError(null);
    const posterType = PAYLOAD_TYPE_MAP[payload.templateId];
    try {
      let data = await fetchPosterTemplates(posterType);
      setTemplates(data);
      if (data.length > 0 && selectedTemplateId === null) {
        setSelectedTemplateId(data[0].id);
        if (data[0].supportedFormats[0]) setFormat(data[0].supportedFormats[0]);
      }
    } catch {
      setTemplatesError('Poster-Vorlagen konnten nicht geladen werden.');
    } finally {
      setTemplatesLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payload.templateId]);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null;
  const supportedFormats = selectedTemplate?.supportedFormats ?? ['1:1'];

  useEffect(() => {
    if (selectedTemplate && !selectedTemplate.supportedFormats.includes(format)) {
      setFormat(selectedTemplate.supportedFormats[0] ?? '1:1');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]);

  const isLoading = clubLoading || templatesLoading;

  useLayoutEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    // Sofort messen, damit scale beim ersten Render korrekt ist.
    // isLoading als Dependency: wenn Templates geladen werden und der Poster
    // sichtbar wird, ist der Dialog seit dem Netzwerk-Roundtrip vollständig
    // im DOM – el.offsetWidth ist dann zuverlässig (kein Fade-In-Timing-Problem).
    const w = el.offsetWidth;
    if (w > 0) setPreviewWidth(w);
    const ro = new ResizeObserver(entries => {
      const rw = entries[0]?.contentRect.width;
      if (rw && rw > 0) setPreviewWidth(rw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, isLoading]);

  const dims = FORMAT_DIMS[format] ?? FORMAT_DIMS['1:1'];
  const scale = previewWidth > 0 ? previewWidth / dims.width : 0;
  // Explizite Höhe in JS statt CSS aspect-ratio: verhindert 1-px-Lücken durch
  // Sub-Pixel-Rounding zwischen aspect-ratio und transform:scale auf HiDPI-Displays.
  const previewHeight = previewWidth > 0
    ? Math.round(previewWidth * dims.height / dims.width)
    : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      // scrollbar-gutter: stable verhindert das Flackern auf Desktop:
      // Das MUI-Paper hat overflow-y: auto. Wenn der Inhalt die max-height
      // überschreitet, erscheint ein Scrollbar und entzieht dem Inhalt ~15px
      // Breite. Der ResizeObserver reagiert → previewHeight ändert sich →
      // Scrollbar verschwindet → Breite nimmt zu → loop. Mit stable wird
      // der Scrollbar-Bereich immer reserviert – die Innenbreite bleibt konstant.
      PaperProps={{ style: { scrollbarGutter: 'stable' } }}
      data-testid="share-poster-dialog"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography fontWeight={700} variant="h6" component="span">Poster teilen</Typography>
        <IconButton onClick={onClose} size="small" aria-label="schließen">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 0, overflow: 'visible', pt: 1.5 }}>
        {templatesError && (
          <Alert severity="error" sx={{ mb: 2 }}>{templatesError}</Alert>
        )}

        {/* Vorlage auswählen */}
        {templates.length > 1 && (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Vorlage</InputLabel>
            <Select
              value={selectedTemplateId ?? ''}
              label="Vorlage"
              onChange={e => {
                const id = Number(e.target.value);
                setSelectedTemplateId(id);
                const tpl = templates.find(t => t.id === id);
                if (tpl?.supportedFormats[0]) setFormat(tpl.supportedFormats[0]);
              }}
            >
              {templates.map(tpl => (
                <MenuItem key={tpl.id} value={tpl.id}>{tpl.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Format-Auswahl */}
        {selectedTemplate && supportedFormats.length > 1 && (
          <Box sx={{ mb: 2 }}>
            <ToggleButtonGroup
              value={format}
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

        <Divider sx={{ mb: 2 }} />

        {/* Poster-Vorschau */}
        <Box
          ref={previewContainerRef}
          data-testid="poster-preview-container"
          data-preview-height={previewHeight ?? 'auto'}
          sx={{
            position: 'relative',
            background: '#0a0a14',
            borderRadius: 2,
            overflow: 'hidden',
            width: '100%',
            // Wenn die Breite noch nicht gemessen wurde, aspectRatio als Fallback;
            // danach explizite Höhe für pixelgenaues Sub-Pixel-Matching.
            ...(previewHeight !== undefined
              ? { height: previewHeight }
              : { aspectRatio: `${dims.width} / ${dims.height}` }),
          }}
        >
          {isLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <CircularProgress sx={{ color: '#fff' }} />
            </Box>
          ) : !selectedTemplate ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', p: 3 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 14 }}>
                Keine Poster-Vorlagen vorhanden.<br />
                Erstelle Vorlagen im Admin-Bereich unter &quot;Poster-Vorlagen&quot;.
              </Typography>
            </Box>
          ) : (
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
                ref={posterRef}
                template={selectedTemplate}
                payload={payload}
                format={format}
                clubName={club?.name ?? ''}
                clubLogoUrl={club?.logoUrl ?? null}
                clubColors={parseClubColors(club?.clubColors)}
              />
            </Box>
          )}
        </Box>

      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <ExportActions posterRef={posterRef} />
      </DialogActions>
    </Dialog>
  );
}
