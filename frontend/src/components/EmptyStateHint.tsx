import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface EmptyStateHintProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  /** Compact variant for inline/dialog contexts — smaller icon, less padding. */
  compact?: boolean;
}

/**
 * Unified empty-state / not-found display.
 * Matches the style of the MyTeam zero-state: centered icon + title + optional description.
 */
export default function EmptyStateHint({ icon, title, description, compact = false }: EmptyStateHintProps) {
  return (
    <Box sx={{ p: compact ? 2 : 3, textAlign: 'center' }}>
      <Box
        sx={{
          mb: compact ? 1 : 2,
          display: 'flex',
          justifyContent: 'center',
          '& .MuiSvgIcon-root': { fontSize: compact ? 40 : 64, color: 'text.disabled' },
        }}
      >
        {icon}
      </Box>
      <Typography variant={compact ? 'subtitle1' : 'h5'} color="text.secondary" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body1" color="text.secondary">
          {description}
        </Typography>
      )}
    </Box>
  );
}
