import React, { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme, alpha } from '@mui/material/styles';
import getCroppedImg from '../utils/cropImage';
import BaseModal from '../modals/BaseModal';
import { BACKEND_URL } from '../../config';
import { apiRequest } from '../utils/api';

interface TeamBannerSectionProps {
  teamId: number;
  bannerImage: string | null | undefined;
  canEditBanner: boolean;
  onBannerChange?: (newBanner: string | null) => void;
}

const BANNER_ASPECT = 16 / 5;

export const TeamBannerSection: React.FC<TeamBannerSectionProps> = ({
  teamId,
  bannerImage,
  canEditBanner,
  onBannerChange,
}) => {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Respect user's OS-level animation preference
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bannerSrc = bannerImage
    ? `${BACKEND_URL}/uploads/team-banners/${bannerImage}`
    : null;

  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  const openCropForFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Ungültiger Dateityp. Erlaubt: JPG, PNG, WebP');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX_SRC_PX = 4000;
      if (img.naturalWidth > MAX_SRC_PX || img.naturalHeight > MAX_SRC_PX) {
        const scale = MAX_SRC_PX / Math.max(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        setRawImageSrc(canvas.toDataURL('image/jpeg', 0.92));
      } else {
        setRawImageSrc(objectUrl);
      }
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropModalOpen(true);
    };
    img.onerror = () => URL.revokeObjectURL(objectUrl);
    img.src = objectUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    openCropForFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canEditBanner) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when leaving the container itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canEditBanner) return;
    const file = e.dataTransfer.files?.[0];
    if (file) openCropForFile(file);
  };

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!rawImageSrc || !croppedAreaPixels) return;
    setSaving(true);
    setError(null);
    try {
      const dataUrl = await getCroppedImg(rawImageSrc, croppedAreaPixels);
      // Convert data URL to Blob
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8 = new Uint8Array(n);
      while (n--) u8[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8], { type: mime });

      const fd = new FormData();
      fd.append('banner', blob, 'banner.jpg');

      const resp = await apiRequest(`/api/teams/${teamId}/banner`, { method: 'POST', body: fd });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Upload fehlgeschlagen');

      onBannerChange?.(data.bannerImage);
      setCropModalOpen(false);
      setRawImageSrc(null);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Hochladen');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteConfirmOpen(false);
    setDeleting(true);
    setError(null);
    try {
      const resp = await apiRequest(`/api/teams/${teamId}/banner`, { method: 'DELETE' });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Löschen fehlgeschlagen');
      }
      onBannerChange?.(null);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen');
    } finally {
      setDeleting(false);
    }
  };

  // ── Entrance animation: Ken Burns reveal on image load ─────────────────────
  const handleImgLoad = () => {
    if (!imgRef.current) return;
    if (prefersReducedMotion) {
      imgRef.current.style.opacity = '1';
      imgRef.current.style.transform = 'scale(1)';
      return;
    }
    // Small rAF delay ensures initial opacity:0/scale styles are painted first
    requestAnimationFrame(() => {
      if (!imgRef.current) return;
      imgRef.current.style.transition = 'opacity 0.85s ease-out, transform 0.85s ease-out';
      imgRef.current.style.opacity = '1';
      imgRef.current.style.transform = 'scale(1)';
    });
  };

  // Reset entrance animation when the banner src changes (new upload)
  useEffect(() => {
    if (!imgRef.current || prefersReducedMotion) return;
    imgRef.current.style.transition = '';
    imgRef.current.style.opacity = '0';
    imgRef.current.style.transform = 'scale(1.05)';
  }, [bannerSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Parallax scroll ───────────────────────────────────────────────────────
  // The wrapper extends 80 px beyond the clipped container on each side.
  // FACTOR 0.22 → ~46 px travel at page load (rect.top ≈ 209) – clearly visible.
  // Keeping extension small (80 px) limits zoom to ~1.57x so a landscape team
  // photo still shows its full width without heavy cropping on the sides.
  useEffect(() => {
    if (!bannerSrc || prefersReducedMotion) return;

    const FACTOR = 0.22;
    const MAX_TY = 80;
    let rafId: number;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (containerRef.current && imgWrapRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const raw = rect.top * FACTOR;
        const ty = Math.max(-MAX_TY, Math.min(MAX_TY, raw));
        imgWrapRef.current.style.transform = `translateY(${ty.toFixed(1)}px)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [bannerSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── No banner, no edit permission → render nothing ────────────────────────
  if (!bannerSrc && !canEditBanner) {
    return null;
  }

  return (
    <>
      <Box
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          position: 'relative',
          width: '100%',
          borderRadius: 2,
          overflow: 'hidden',
          mb: 3,
          aspectRatio: `${BANNER_ASPECT}`,
          maxHeight: 280,
          bgcolor: bannerSrc ? 'transparent' : alpha(theme.palette.primary.main, 0.04),
          border: isDragOver
            ? `2px dashed ${theme.palette.primary.main}`
            : bannerSrc
            ? 'none'
            : `2px dashed ${alpha(theme.palette.primary.main, 0.25)}`,
          transition: 'border-color 0.15s, background-color 0.15s',
          ...(isDragOver && {
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          }),
        }}
      >
        {bannerSrc ? (
          <>
            {/* Parallax wrapper – extends 80 px beyond container on each side.
                overflow:hidden on the parent clips it; translateY shifts which
                crop of the (oversized) image is visible. */}
            <Box
              ref={imgWrapRef}
              sx={{
                position: 'absolute',
                top: -80,
                left: 0,
                right: 0,
                bottom: -80,
                willChange: 'transform',
              }}
            >
              <img
                ref={imgRef}
                src={bannerSrc}
                alt="Team Banner"
                onLoad={handleImgLoad}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  // Initial state – Ken Burns reveal animates these to 1 / scale(1)
                  opacity: 0,
                  transform: prefersReducedMotion ? 'none' : 'scale(1.05)',
                }}
              />
            </Box>
            {/* Gradient overlay at bottom for visual polish */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '40%',
                background: `linear-gradient(to top, ${alpha(theme.palette.background.default, 0.6)} 0%, transparent 100%)`,
                pointerEvents: 'none',
              }}
            />
            {/* Drag-over highlight on existing banner */}
            {isDragOver && canEditBanner && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.45),
                  color: '#fff',
                  pointerEvents: 'none',
                }}
              >
                <AddPhotoAlternateIcon sx={{ fontSize: 40 }} />
                <Typography variant="body2" fontWeight={600}>Bild hier ablegen…</Typography>
              </Box>
            )}
          </>
        ) : (
          /* Empty state placeholder – only visible to editors */
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 1,
              color: isDragOver ? 'primary.main' : 'text.disabled',
              transition: 'color 0.15s',
              pointerEvents: 'none',
            }}
          >
            <AddPhotoAlternateIcon sx={{ fontSize: 40 }} />
            <Typography variant="body2">
              {isDragOver ? 'Bild hier ablegen…' : 'Bild hierher ziehen oder per Button hochladen'}
            </Typography>
          </Box>
        )}

        {/* Edit controls – only for editors */}
        {canEditBanner && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              gap: 0.75,
            }}
          >
            <Tooltip title="Banner hochladen / ändern">
              <IconButton
                size="small"
                onClick={() => inputRef.current?.click()}
                sx={{
                  bgcolor: alpha(theme.palette.background.paper, 0.85),
                  backdropFilter: 'blur(4px)',
                  '&:hover': { bgcolor: theme.palette.background.paper },
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {bannerSrc && (
              <Tooltip title="Banner löschen">
                <IconButton
                  size="small"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={deleting}
                  sx={{
                    bgcolor: alpha(theme.palette.background.paper, 0.85),
                    backdropFilter: 'blur(4px)',
                    color: 'error.main',
                    '&:hover': { bgcolor: theme.palette.background.paper },
                  }}
                >
                  {deleting ? <CircularProgress size={14} /> : <DeleteIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}

        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ position: 'absolute', bottom: 8, left: 8, right: 8, py: 0.25 }}
          >
            {error}
          </Alert>
        )}
      </Box>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Crop dialog */}
      <BaseModal
        open={cropModalOpen}
        onClose={() => { setCropModalOpen(false); setRawImageSrc(null); }}
        title="Banner zuschneiden"
        maxWidth="md"
        actions={
          <>
            <Button
              variant="outlined"
              onClick={() => { setCropModalOpen(false); setRawImageSrc(null); }}
              disabled={saving}
            >
              Abbrechen
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !croppedAreaPixels}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {saving ? 'Wird gespeichert…' : 'Speichern'}
            </Button>
          </>
        }
      >
        <Box sx={{ width: '100%' }}>
          {/* Crop area – container uses EXACT banner aspect ratio so the crop frame
              fills the entire dark box. No black bars above/below = no visual confusion. */}
          <Box sx={{ position: 'relative', width: '100%', aspectRatio: `${BANNER_ASPECT}`, minHeight: 120, bgcolor: '#111' }}>
            {rawImageSrc && (
              <Cropper
                image={rawImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={BANNER_ASPECT}
                objectFit="horizontal-cover"
                cropShape="rect"
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </Box>

          {/* Zoom slider */}
          <Box sx={{ px: 3, pt: 2, pb: 1 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Zoom
            </Typography>
            <Slider
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(_, v) => setZoom(v as number)}
              aria-label="Zoom"
              size="small"
            />
          </Box>
        </Box>
      </BaseModal>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Banner wirklich löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Das Team-Banner wird unwiderruflich entfernt. Möchtest du fortfahren?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TeamBannerSection;
