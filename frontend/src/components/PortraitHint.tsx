import React, { useCallback, useState } from 'react';
import { Box, Button, Typography, IconButton, Tooltip } from '@mui/material';
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation';
import CloseIcon from '@mui/icons-material/Close';

interface PortraitHintProps {
  /** Nur anzeigen wenn true */
  visible: boolean;
}

/**
 * Dezenter, wegwischbarer Banner am oberen Rand des Taktik-Boards.
 * Erscheint nur auf mobilen Geräten im Hochformat.
 * Blockiert die Ansicht nicht – der Nutzer kann ihn schließen oder ignorieren.
 */
const PortraitHint: React.FC<PortraitHintProps> = ({ visible }) => {
  const [dismissed, setDismissed] = useState(false);

  const handleRotate = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (screen.orientation as any).lock('landscape');
    } catch {
      // API nicht verfügbar (z. B. iOS Safari) – Nutzer muss manuell drehen
    }
  }, []);

  if (!visible || dismissed) return null;

  return (
    <Box
      role="status"
      aria-label="Querformat empfohlen"
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.75,
        bgcolor: 'rgba(10, 18, 10, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <ScreenRotationIcon
        sx={{
          fontSize: 16,
          color: 'rgba(255,255,255,0.5)',
          flexShrink: 0,
          animation: 'portrait-rotate 3s ease-in-out infinite',
          '@keyframes portrait-rotate': {
            '0%, 70%, 100%': { transform: 'rotate(0deg)' },
            '30%':           { transform: 'rotate(-90deg)' },
          },
        }}
      />

      <Typography
        variant="caption"
        sx={{ color: 'rgba(255,255,255,0.55)', flex: 1, lineHeight: 1.3, fontSize: '0.72rem' }}
      >
        Querformat für optimale Darstellung.
      </Typography>

      <Button
        size="small"
        variant="outlined"
        startIcon={<ScreenRotationIcon sx={{ fontSize: 14 }} />}
        onClick={handleRotate}
        sx={{
          flexShrink: 0,
          fontSize: '0.68rem',
          py: 0.25,
          px: 1,
          borderColor: 'rgba(33,150,243,0.5)',
          color: 'rgba(33,150,243,0.9)',
          minHeight: 0,
          '&:hover': { borderColor: 'rgba(33,150,243,0.9)', bgcolor: 'rgba(33,150,243,0.1)' },
        }}
      >
        Drehen
      </Button>

      <Tooltip title="Hinweis schließen" placement="left">
        <IconButton
          size="small"
          onClick={() => setDismissed(true)}
          aria-label="Hinweis schließen"
          sx={{
            color: 'rgba(255,255,255,0.3)',
            p: 0.25,
            flexShrink: 0,
            '&:hover': { color: 'rgba(255,255,255,0.7)', bgcolor: 'transparent' },
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default PortraitHint;
