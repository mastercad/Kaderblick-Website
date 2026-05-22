import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import { useNavigate } from 'react-router-dom';
import {
  fetchPosterTemplates,
  deletePosterTemplate,
} from '../../services/posterTemplateService';
import type { PosterTemplateDefinition, PosterFormat, PosterType } from '../PosterGenerator/types/posterTemplate';
import { FORMAT_DIMS } from '../PosterGenerator/types/posterTemplate';
import { DynamicPosterRenderer } from '../PosterGenerator/DynamicPosterRenderer';

// ─── Hilfstexte ──────────────────────────────────────────────────────────────

const POSTER_TYPE_LABELS: Record<PosterType, string> = {
  game_announcement:  'Spielankündigung',
  game_result:        'Spielergebnis',
  event_announcement: 'Event-Ankündigung',
  player_highlight:   'Spieler-Highlight',
  universal:          'Universal',
};

const POSTER_TYPE_COLORS: Record<PosterType, 'primary' | 'secondary' | 'success' | 'warning' | 'default'> = {
  game_announcement:  'primary',
  game_result:        'success',
  event_announcement: 'secondary',
  player_highlight:   'warning',
  universal:          'default',
};

// ─── Mini-Vorschau ────────────────────────────────────────────────────────────

const THUMB_WIDTH = 220;

function TemplatePreviewThumb({ template }: { template: PosterTemplateDefinition }) {
  const format: PosterFormat = (template.supportedFormats?.[0] as PosterFormat) ?? '1:1';
  const dims = FORMAT_DIMS[format] ?? FORMAT_DIMS['1:1'];
  const scale = THUMB_WIDTH / dims.width;
  const thumbHeight = Math.round(dims.height * scale);
  // Leeres payload → DynamicPosterRenderer zeigt Platzhalter als [key]
  const mockPayload = { templateId: '', data: {} } as any;
  const fullTemplate = { ...template, id: template.id ?? 0, createdAt: '', updatedAt: '' };

  return (
    <Box
      sx={{
        width: THUMB_WIDTH,
        height: thumbHeight,
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative',
        mb: 1.5,
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
          format={format}
          clubName="FC Musterstadt e.V."
        />
      </Box>
    </Box>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function PosterTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<PosterTemplateDefinition[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPosterTemplates();
      setTemplates(data);
    } catch {
      setError('Vorlagen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDeleteConfirm = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await deletePosterTemplate(deleteId);
      setTemplates(prev => prev.filter(t => t.id !== deleteId));
    } catch {
      setError('Vorlage konnte nicht gelöscht werden.');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{
            fontWeight: 700
          }}>Poster-Vorlagen</Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mt: 0.5
            }}>
            Erstelle und verwalte Vorlagen für Spielankündigungen, Ergebnisse und Events.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/poster-vorlagen/neu')}
          sx={{ flexShrink: 0 }}
        >
          Neue Vorlage
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : templates.length === 0 ? (
        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 6,
            textAlign: 'center',
          }}
        >
          <ImageIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" sx={{
            color: "text.secondary"
          }}>Noch keine Vorlagen</Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.disabled",
              mt: 1,
              mb: 3
            }}>
            Erstelle deine erste Vorlage mit dem visuellen Editor.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/poster-vorlagen/neu')}
          >
            Erste Vorlage erstellen
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {templates.map(tpl => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={tpl.id}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 4 },
                }}
              >
                <CardActionArea
                  onClick={() => navigate(`/admin/poster-vorlagen/${tpl.id}`)}
                  sx={{ flexGrow: 1, p: 2 }}
                >
                  <TemplatePreviewThumb template={tpl} />
                  <Typography variant="subtitle1" noWrap sx={{
                    fontWeight: 700
                  }}>
                    {tpl.name}
                  </Typography>
                  {tpl.description && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        mt: 0.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                      {tpl.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={POSTER_TYPE_LABELS[tpl.posterType as PosterType] ?? tpl.posterType}
                      color={POSTER_TYPE_COLORS[tpl.posterType as PosterType] ?? 'default'}
                      size="small"
                    />
                    {tpl.supportedFormats.map(fmt => (
                      <Chip key={fmt} label={fmt} size="small" variant="outlined" />
                    ))}
                  </Box>
                </CardActionArea>

                <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                  <Tooltip title="Bearbeiten">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/admin/poster-vorlagen/${tpl.id}`)}
                      aria-label="Bearbeiten"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Löschen">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteId(tpl.id)}
                      aria-label="Löschen"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      {/* Löschen-Dialog */}
      <Dialog open={deleteId !== null} onClose={() => !deleting && setDeleteId(null)}>
        <DialogTitle>Vorlage löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Diese Vorlage wird unwiderruflich gelöscht. Bereits erstellte Poster sind davon nicht betroffen.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} disabled={deleting}>Abbrechen</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={18} /> : 'Löschen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
