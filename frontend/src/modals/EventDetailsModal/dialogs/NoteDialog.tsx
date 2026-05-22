import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { ParticipationStatus } from '../types';

interface NoteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pendingStatus: ParticipationStatus | undefined;
  note: string;
  onNoteChange: (value: string) => void;
}

export const NoteDialog: React.FC<NoteDialogProps> = ({
  open,
  onClose,
  onConfirm,
  pendingStatus,
  note,
  onNoteChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      sx={isMobile ? { '& .MuiDialog-container': { alignItems: 'flex-end' } } : {}}
      slotProps={{
        paper: { sx: { borderRadius: isMobile ? 0 : 3, m: isMobile ? 0 : 2, width: '100%' } }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} sx={{
          alignItems: "center"
        }}>
          {pendingStatus?.color && (
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: pendingStatus.color,
                flexShrink: 0,
              }}
            />
          )}
          <Typography variant="subtitle1" sx={{
            fontWeight: 700
          }}>
            {pendingStatus?.name ?? 'Rückmeldung'}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 1.5
          }}>
          Möchtest du eine Nachricht hinzufügen? (optional)
        </Typography>
        <TextField
          id="participation-note"
          label="Nachricht (optional)"
          value={note}
          onChange={e => onNoteChange(e.target.value)}
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          autoFocus
          placeholder="z.B. Komme 10 Minuten später&#10;Bringe Eierschecke mit&#10;…"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          helperText={`${note.length}/300`}
          slotProps={{
            htmlInput: { maxLength: 300 }
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, flex: 1 }}>
          Abbrechen
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{
            borderRadius: 2,
            flex: 2,
            bgcolor: pendingStatus?.color || undefined,
            '&:hover': {
              bgcolor: pendingStatus?.color ? `${pendingStatus.color}cc` : undefined,
            },
          }}
        >
          Bestätigen
        </Button>
      </DialogActions>
    </Dialog>
  );
};
