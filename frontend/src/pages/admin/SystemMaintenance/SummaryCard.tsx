import React from 'react';
import { Paper, Typography } from '@mui/material';

interface Props {
  label: string;
  value: number;
  color: 'success' | 'error' | 'default';
  onClick?: () => void;
  active?: boolean;
}

const bgMap    = { success: 'success.50', error: 'error.50', default: 'grey.100' } as const;
const colorMap = { success: 'success.main', error: 'error.main', default: 'text.primary' } as const;

export default function SummaryCard({ label, value, color, onClick, active }: Props) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        px: 2.5,
        py: 1.5,
        minWidth: 140,
        bgcolor: bgMap[color],
        cursor: onClick ? 'pointer' : 'default',
        outline: active ? '2px solid' : 'none',
        outlineColor: active ? colorMap[color] : undefined,
        outlineOffset: 2,
        transition: 'outline 0.1s, box-shadow 0.1s',
        '&:hover': onClick ? { boxShadow: 3 } : undefined,
      }}
    >
      <Typography variant="h4" fontWeight={700} color={colorMap[color]}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}
