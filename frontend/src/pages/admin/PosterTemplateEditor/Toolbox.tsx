import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Snackbar,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';
import { listPosterImages, uploadPosterImage, deletePosterImage } from '../../../services/posterTemplateService';
import { ApiError } from '../../../utils/api';
import { PLACEHOLDER_LABELS } from '../../PosterGenerator/types/posterTemplate';
import type { PlaceholderKey } from '../../PosterGenerator/types/posterTemplate';
import DebouncedColorInput from './DebouncedColorInput';
import type { ToolboxProps } from './types';

export default function Toolbox({ onAddPlaceholder, onAddCustomText, background, onBgChange }: ToolboxProps) {
  const placeholders = Object.entries(PLACEHOLDER_LABELS) as [PlaceholderKey, string][];
  const [posterImages, setPosterImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageEnabled, setImageEnabled] = useState(Boolean(background.imageUrl));
  const [deleteError, setDeleteError] = useState<{ templates?: string[]; message?: string } | null>(null);
  const [confirmDeleteUrl, setConfirmDeleteUrl] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Bilderliste einmalig laden
  useEffect(() => {
    listPosterImages().then(setPosterImages).catch(() => {});
  }, []);

  // imageEnabled mit externem background.imageUrl synchron halten
  useEffect(() => {
    setImageEnabled(Boolean(background.imageUrl));
  }, [background.imageUrl]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadPosterImage(file);
      setPosterImages(prev => [...prev, url]);
      onBgChange({ ...background, imageUrl: url });
    } catch { /* ignore */ } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleImageDelete = async (url: string) => {
    setConfirmDeleteUrl(null);
    try {
      await deletePosterImage(url);
      setPosterImages(prev => prev.filter(u => u !== url));
      if (background.imageUrl === url) {
        onBgChange({ ...background, imageUrl: undefined, colorOpacity: undefined });
      }
      setDeleteSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data?.templates) {
        setDeleteError({ templates: err.data.templates });
      } else {
        const msg = err instanceof ApiError ? err.message : 'Fehler beim Löschen des Bildes.';
        setDeleteError({ message: msg });
      }
    }
  };

  return (
    <>
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Elemente ── */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="overline" color="text.secondary" display="block" gutterBottom>
          Elemente
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mb: 1 }}>
          {placeholders.map(([key, label]) => (
            <Button
              key={key}
              size="small"
              variant="outlined"
              startIcon={<AddIcon sx={{ fontSize: '13px !important' }} />}
              onClick={() => onAddPlaceholder(key)}
              sx={{ justifyContent: 'flex-start', textTransform: 'none', fontSize: 11, px: 1, py: 0.5, minHeight: 'unset', lineHeight: 1.3 }}
            >
              {label}
            </Button>
          ))}
        </Box>
        <Button
          fullWidth size="small" variant="contained" color="primary"
          startIcon={<AddIcon />} onClick={onAddCustomText}
          sx={{ textTransform: 'none' }}
        >
          Freier Text
        </Button>
      </Box>

      {/* ── Hintergrund ── */}
      <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
        <Typography variant="overline" color="text.secondary" display="block" gutterBottom>
          Hintergrund
        </Typography>
        <Divider sx={{ mb: 1.5 }} />

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Typ</InputLabel>
          <Select
            value={background.type === 'image' ? 'solid' : background.type}
            label="Typ"
            onChange={e => onBgChange({ ...background, type: e.target.value as any })}
          >
            <MenuItem value="solid">Einfarbig</MenuItem>
            <MenuItem value="gradient">Verlauf</MenuItem>
          </Select>
        </FormControl>

        {background.type === 'solid' && (
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>Farbe</Typography>
            <DebouncedColorInput
              value={background.color ?? '#111111'}
              onChange={v => onBgChange({ ...background, color: v })}
            />
          </Stack>
        )}

        {background.type === 'gradient' && (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ width: 28 }}>Von</Typography>
              <DebouncedColorInput
                value={(background.gradientColors ?? ['#0a0a2e', '#1a1a6e'])[0]}
                onChange={v => {
                  const c = [...(background.gradientColors ?? ['#0a0a2e', '#1a1a6e'])];
                  c[0] = v;
                  onBgChange({ ...background, gradientColors: c });
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ width: 20 }}>Bis</Typography>
              <DebouncedColorInput
                value={(background.gradientColors ?? ['#0a0a2e', '#1a1a6e'])[1]}
                onChange={v => {
                  const c = [...(background.gradientColors ?? ['#0a0a2e', '#1a1a6e'])];
                  c[1] = v;
                  onBgChange({ ...background, gradientColors: c });
                }}
              />
            </Stack>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Winkel: {background.gradientAngle ?? 135}°
              </Typography>
              <Slider
                min={0} max={360}
                value={background.gradientAngle ?? 135}
                onChange={(_, v) => onBgChange({ ...background, gradientAngle: v as number })}
                size="small" color="primary"
              />
            </Box>
          </Stack>
        )}

        {/* ── Hintergrundbild (optional, kombinierbar mit Farbe/Verlauf) ── */}
        <Divider sx={{ my: 1.5 }} />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={imageEnabled}
              onChange={e => {
                const enabled = e.target.checked;
                setImageEnabled(enabled);
                if (enabled) {
                  // Farbe transparent starten, damit das Bild sofort sichtbar ist
                  onBgChange({ ...background, colorOpacity: 0 });
                } else {
                  onBgChange({ ...background, imageUrl: undefined, colorOpacity: undefined });
                }
              }}
            />
          }
          label={<Typography variant="body2" color="text.secondary">Hintergrundbild</Typography>}
        />
        {imageEnabled && (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Button
              component="label" size="small" fullWidth variant="outlined"
              startIcon={uploading ? <CircularProgress size={13} /> : <UploadIcon />}
              disabled={uploading} sx={{ textTransform: 'none' }}
            >
              {uploading ? 'Wird hochgeladen…' : 'Bild hochladen'}
              <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
            </Button>

            {posterImages.length > 0 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.75 }}>
                {posterImages.map(url => (
                  <Box
                    key={url}
                    sx={{
                      position: 'relative',
                      aspectRatio: '1',
                      backgroundImage: `url(${url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      cursor: 'pointer',
                      borderRadius: 1,
                      border: '2px solid',
                      borderColor: background.imageUrl === url ? 'primary.main' : 'divider',
                      transition: 'border-color .15s',
                      '&:hover': { borderColor: 'primary.light' },
                      '&:hover .img-delete-btn': { opacity: 1 },
                    }}
                    onClick={() => onBgChange({ ...background, imageUrl: url })}
                  >
                    <Tooltip title="Bild löschen">
                      <IconButton
                        className="img-delete-btn"
                        size="small"
                        onClick={e => { e.stopPropagation(); setConfirmDeleteUrl(url); }}
                        sx={{
                          position: 'absolute', top: 2, right: 2,
                          opacity: 0, transition: 'opacity .15s',
                          bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                          '&:hover': { bgcolor: 'error.main' },
                          p: 0.25,
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            )}

            {background.imageUrl && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Deckkraft der Farbschicht: {Math.round((background.colorOpacity ?? 0) * 100)}%
                </Typography>
                <Slider
                  min={0} max={1} step={0.05}
                  value={background.colorOpacity ?? 0}
                  onChange={(_, v) => onBgChange({ ...background, colorOpacity: v as number })}
                  size="small" color="primary"
                />
              </Box>
            )}
          </Stack>
        )}
      </Box>
    </Box>

    {/* Dialog: Löschen bestätigen */}
    <Dialog open={confirmDeleteUrl !== null} onClose={() => setConfirmDeleteUrl(null)} maxWidth="xs" fullWidth>
      <DialogTitle>Bild löschen?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Soll das Bild wirklich unwiderruflich gelöscht werden?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmDeleteUrl(null)}>Abbrechen</Button>
        <Button color="error" variant="contained" onClick={() => confirmDeleteUrl && handleImageDelete(confirmDeleteUrl)}>
          Löschen
        </Button>
      </DialogActions>
    </Dialog>

    {/* Snackbar: Erfolgreich gelöscht */}
    <Snackbar
      open={deleteSuccess}
      autoHideDuration={3000}
      onClose={() => setDeleteSuccess(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="success" onClose={() => setDeleteSuccess(false)} sx={{ width: '100%' }}>
        Bild wurde erfolgreich gelöscht.
      </Alert>
    </Snackbar>

    {/* Dialog: Fehler beim Löschen */}
    <Dialog open={deleteError !== null} onClose={() => setDeleteError(null)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        {deleteError?.templates ? 'Bild wird noch verwendet' : 'Fehler beim Löschen'}
        <IconButton size="small" onClick={() => setDeleteError(null)}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        {deleteError?.templates ? (
          <>
            <Typography variant="body2" gutterBottom>
              Das Bild kann nicht gelöscht werden, da es noch in folgenden Vorlagen verwendet wird:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
              {deleteError.templates.map(name => (
                <Typography key={name} component="li" variant="body2" fontWeight="medium">{name}</Typography>
              ))}
            </Box>
          </>
        ) : (
          <Typography variant="body2">{deleteError?.message}</Typography>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
