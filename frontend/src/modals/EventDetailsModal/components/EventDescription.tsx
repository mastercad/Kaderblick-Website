import React from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DescriptionIcon from '@mui/icons-material/Description';

interface EventDescriptionProps {
  description: string;
}

export const EventDescription: React.FC<EventDescriptionProps> = ({ description }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
    <Stack direction="row" spacing={1} sx={{
      alignItems: "flex-start"
    }}>
      <DescriptionIcon sx={{ fontSize: 20, color: 'text.secondary', mt: 0.25, flexShrink: 0 }} />
      <Typography
        variant="body2"
        sx={{
          color: "text.primary",
          whiteSpace: 'pre-wrap'
        }}>
        {description}
      </Typography>
    </Stack>
  </Paper>
);
