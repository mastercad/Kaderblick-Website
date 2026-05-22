import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined';
import type { CurrentParticipation } from '../types';

interface ParticipationStatusBadgeProps {
  participation: CurrentParticipation;
  saving: boolean;
  onEditNote: () => void;
}

export const ParticipationStatusBadge: React.FC<ParticipationStatusBadgeProps> = ({
  participation,
  saving,
  onEditNote,
}) => (
  <Paper
    variant="outlined"
    sx={{
      mb: 1.5,
      p: 1.25,
      borderRadius: 2,
      borderColor: participation.color || 'divider',
      bgcolor: `${participation.color || '#888'}18`,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 1,
    }}
  >
    <CheckCircleOutlineIcon
      sx={{
        fontSize: 18,
        color: participation.color || 'text.secondary',
        mt: 0.15,
        flexShrink: 0,
      }}
    />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          color: participation.color || 'text.primary'
        }}>
        {participation.statusName}
      </Typography>
      {participation.note && (
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            display: 'block',
            fontStyle: 'italic',
            wordBreak: 'break-word'
          }}>
          {participation.note}
        </Typography>
      )}
    </Box>
    <Button
      size="small"
      variant="text"
      startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />}
      onClick={onEditNote}
      disabled={saving}
      sx={{
        flexShrink: 0,
        textTransform: 'none',
        fontSize: '0.75rem',
        color: 'text.secondary',
        minWidth: 0,
      }}
    >
      Notiz
    </Button>
  </Paper>
);
