import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface TaskDeletionModalProps {
  open: boolean;
  onClose: () => void;
  onDeleteSingle: () => void;
  onDeleteFromHere?: () => void;
  onDeleteSeries: () => void;
  loading?: boolean;
  title?: string;
  message?: string;
  singleLabel?: string;
  fromHereLabel?: string;
  seriesLabel?: string;
}

export const TaskDeletionModal: React.FC<TaskDeletionModalProps> = ({
  open,
  onClose,
  onDeleteSingle,
  onDeleteFromHere,
  onDeleteSeries,
  loading = false,
  title = 'Task löschen',
  message = 'Möchten Sie nur dieses Event oder die gesamte Task-Serie löschen?',
  singleLabel = 'Nur dieses Event',
  fromHereLabel,
  seriesLabel = 'Gesamte Serie',
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
    <DialogContent sx={{ pt: 0, pb: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </DialogContent>
    <Divider />
    <Stack sx={{ p: 1 }} spacing={0.5}>
      <Button
        onClick={onDeleteSingle}
        variant="text"
        color="inherit"
        disabled={loading}
        fullWidth
        sx={{ justifyContent: 'flex-start', px: 2, py: 1 }}
      >
        {singleLabel}
      </Button>
      {onDeleteFromHere && fromHereLabel && (
        <Button
          onClick={onDeleteFromHere}
          variant="text"
          color="warning"
          disabled={loading}
          fullWidth
          sx={{ justifyContent: 'flex-start', px: 2, py: 1 }}
        >
          {fromHereLabel}
        </Button>
      )}
      <Button
        onClick={onDeleteSeries}
        variant="text"
        color="error"
        disabled={loading}
        fullWidth
        sx={{ justifyContent: 'flex-start', px: 2, py: 1 }}
      >
        {seriesLabel}
      </Button>
    </Stack>
    <Divider />
    <DialogActions sx={{ px: 2, py: 1 }}>
      <Button onClick={onClose} disabled={loading} color="inherit">
        Abbrechen
      </Button>
    </DialogActions>
  </Dialog>
);
