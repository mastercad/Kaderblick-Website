import React, { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import UploadIcon from '@mui/icons-material/Upload';
import { alpha, useTheme } from '@mui/material/styles';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import getCroppedImg from '../../../utils/cropImage';
import { BACKEND_URL } from '../../../../config';
import BaseModal from '../../BaseModal';

interface AvatarPickerDialogProps {
  open: boolean;
  avatarFile: File | null;
  avatarUrl: string;
  googleAvatarUrl: string;
  useGoogleAvatar: boolean;
  onClose: () => void;
  onAvatarFileChange: (file: File | null) => void;
  onAvatarUrlChange: (url: string) => void;
  onUseGoogleAvatarChange: (value: boolean) => void;
}

export function AvatarPickerDialog({
  open, avatarFile, avatarUrl, googleAvatarUrl, useGoogleAvatar,
  onClose, onAvatarFileChange, onAvatarUrlChange, onUseGoogleAvatarChange,
}: AvatarPickerDialogProps) {
  const muiTheme = useTheme();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dropJustHappened = useRef(false);
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (avatarFile && croppedAreaPixels) {
      setApplying(true);
      try {
        const cropped = await getCroppedImg(URL.createObjectURL(avatarFile), croppedAreaPixels);
        if (cropped) {
          const arr = cropped.split(',');
          const match = arr[0].match(/:(.*?);/);
          const mime = match ? match[1] : '';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) u8arr[n] = bstr.charCodeAt(n);
          onAvatarFileChange(new File([u8arr], 'avatar.png', { type: mime }));
        }
      } finally {
        setApplying(false);
      }
    }
    onClose();
  };

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="Profilbild ändern"
      maxWidth="xs"
      actions={
        <>
          <Button onClick={onClose} variant="outlined">Abbrechen</Button>
          <Button
            onClick={handleApply}
            variant="contained"
            disabled={applying || !(avatarFile || avatarUrl || useGoogleAvatar)}
            startIcon={applying ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Übernehmen
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 1 }}>
        {/* Google Avatar Toggle */}
        {googleAvatarUrl && (
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            p: 1.5, borderRadius: 2, border: '1px solid',
            borderColor: useGoogleAvatar ? 'primary.main' : 'divider',
            bgcolor: useGoogleAvatar ? alpha(muiTheme.palette.primary.main, 0.06) : 'transparent',
            width: '100%', maxWidth: 300,
          }}>
            <Avatar src={googleAvatarUrl} sx={{ width: 56, height: 56 }} />
            <FormControlLabel
              control={
                <Switch
                  checked={useGoogleAvatar}
                  onChange={e => {
                    onUseGoogleAvatarChange(e.target.checked);
                    if (e.target.checked) onAvatarFileChange(null);
                  }}
                  size="small"
                />
              }
              label={<Typography variant="body2" fontWeight={600}>Google-Profilbild verwenden</Typography>}
              sx={{ m: 0 }}
            />
            {useGoogleAvatar && (
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Dein Google-Profilbild wird als Avatar angezeigt.
              </Typography>
            )}
          </Box>
        )}

        {/* Upload area */}
        <Box sx={{
          opacity: useGoogleAvatar ? 0.4 : 1,
          pointerEvents: useGoogleAvatar ? 'none' : 'auto',
          width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}>
          <Box sx={{ position: 'relative', width: 220, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
              onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
              onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
              onDrop={e => {
                e.preventDefault(); e.stopPropagation();
                setDragActive(false);
                if (e.dataTransfer.files?.[0]) {
                  onAvatarFileChange(e.dataTransfer.files[0]);
                  onAvatarUrlChange('');
                  dropJustHappened.current = true;
                  setTimeout(() => { dropJustHappened.current = false; }, 100);
                }
              }}
              sx={{
                width: 220, height: 220,
                border: dragActive ? '3px solid' : '2px dashed',
                borderColor: dragActive ? 'primary.main' : 'grey.400',
                borderRadius: '50%',
                boxShadow: dragActive ? `0 0 0 4px ${alpha(muiTheme.palette.primary.main, 0.25)}` : '0 0 16px 0 rgba(0,0,0,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: dragActive ? alpha(muiTheme.palette.primary.main, 0.06) : 'background.paper',
                position: 'relative', overflow: 'hidden',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              {avatarFile ? (
                <Box sx={{ width: '100%', height: '100%', pointerEvents: dragActive ? 'none' : 'auto' }}>
                  <Cropper
                    image={URL.createObjectURL(avatarFile)}
                    crop={crop} zoom={zoom} aspect={1}
                    cropShape="round" showGrid={false}
                    onCropChange={setCrop} onZoomChange={setZoom}
                    onCropComplete={(_, pix) => setCroppedAreaPixels(pix)}
                    style={{ containerStyle: { width: '100%', height: '100%' } }}
                  />
                </Box>
              ) : (
                <Avatar
                  src={avatarUrl ? `${BACKEND_URL}/uploads/avatar/${avatarUrl}` : undefined}
                  sx={{ width: 120, height: 120, pointerEvents: dragActive ? 'none' : 'auto' }}
                />
              )}
              <input id="avatar-upload-input" type="file" accept="image/*" hidden
                onChange={e => {
                  if (e.target.files?.[0]) {
                    onAvatarFileChange(e.target.files[0]);
                    onAvatarUrlChange('');
                  }
                }}
              />
              <Box sx={{
                position: 'absolute', bottom: 18, left: 10, right: 10, textAlign: 'center',
                fontSize: 12, color: 'white', fontWeight: 700,
                textShadow: '0 2px 8px rgba(0,0,0,0.85)', pointerEvents: 'none',
              }}>
                Bild hierher ziehen
              </Box>
            </Box>
            <Button variant="outlined" startIcon={<UploadIcon />}
              sx={{ mt: 2, borderRadius: 2, textTransform: 'none' }}
              onClick={() => document.getElementById('avatar-upload-input')?.click()}>
              Bild auswählen
            </Button>
          </Box>
          <TextField
            label="Oder Avatar-URL eingeben"
            value={avatarUrl}
            size="small" fullWidth
            sx={{ maxWidth: 300 }}
            onChange={e => { onAvatarUrlChange(e.target.value); onAvatarFileChange(null); }}
          />
        </Box>
      </Box>
    </BaseModal>
  );
}
