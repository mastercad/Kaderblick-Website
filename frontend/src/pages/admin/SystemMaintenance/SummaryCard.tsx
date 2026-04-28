import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

interface Props {
  label: string;
  value: number;
  color: 'success' | 'error' | 'warning' | 'default';
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

const bgMap    = { success: 'success.50', error: 'error.50', warning: 'warning.50', default: 'grey.50' } as const;
const colorMap = { success: 'success.main', error: 'error.main', warning: 'warning.main', default: 'text.secondary' } as const;

export default function SummaryCard({ label, value, color, icon, onClick, active }: Props) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2,
        flex: '1 1 0',
        minWidth: 0,
        bgcolor: active ? bgMap[color] : 'background.paper',
        borderColor: active ? colorMap[color] : 'divider',
        borderWidth: active ? 2 : 1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
        '&:hover': onClick ? { boxShadow: 2, borderColor: colorMap[color] } : undefined,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="h5" fontWeight={700} color={active ? colorMap[color] : 'text.primary'} lineHeight={1}>
          {value.toLocaleString('de-DE')}
        </Typography>
        {icon && (
          <Box sx={{ color: colorMap[color], opacity: active ? 1 : 0.4, mt: '2px', ml: 1, display: 'flex' }}>
            {icon}
          </Box>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.3 }}>
        {label}
      </Typography>
    </Paper>
  );
}
