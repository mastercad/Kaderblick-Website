import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CancelIcon from '@mui/icons-material/EventBusy';
import RestoreIcon from '@mui/icons-material/EventAvailable';

interface CancelledBannerProps {
  cancelReason?: string;
  cancelledBy?: string;
  canCancel?: boolean;
  reactivating: boolean;
  onReactivate: () => void;
}

export const CancelledBanner: React.FC<CancelledBannerProps> = ({
  cancelReason,
  cancelledBy,
  canCancel,
  reactivating,
  onReactivate,
}) => (
  <Paper
    elevation={0}
    sx={{
      mb: 2,
      p: 1.5,
      borderRadius: 2,
      bgcolor: 'error.main',
      color: '#fff',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 1.5,
    }}
  >
    <CancelIcon sx={{ mt: 0.25, fontSize: 28, flexShrink: 0 }} />
    <Box>
      <Typography variant="subtitle2" sx={{
        fontWeight: 700
      }}>Abgesagt</Typography>
      {cancelReason && (
        <Typography variant="body2" sx={{ opacity: 0.92 }}>{cancelReason}</Typography>
      )}
      {cancelledBy && (
        <Typography variant="caption" sx={{ opacity: 0.75, display: 'block' }}>
          Abgesagt von {cancelledBy}
        </Typography>
      )}
      {canCancel && (
        <Button
          onClick={onReactivate}
          variant="contained"
          size="small"
          startIcon={<RestoreIcon />}
          disabled={reactivating}
          sx={{
            mt: 1,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.2)',
            color: '#fff',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
          }}
        >
          {reactivating ? 'Wird reaktiviert…' : 'Event reaktivieren'}
        </Button>
      )}
    </Box>
  </Paper>
);
