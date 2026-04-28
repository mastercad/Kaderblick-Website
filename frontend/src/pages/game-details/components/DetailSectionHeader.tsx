import React from 'react';
import { Box, Typography, Chip, IconButton, alpha } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { DetailSectionHeaderProps } from '../types';

const DetailSectionHeader = ({
  icon,
  label,
  count,
  color,
  open,
  onToggle,
  action,
  testId,
}: DetailSectionHeaderProps) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      mb: 1.25,
      mt: 1,
      p: 0.75,
      borderRadius: 2,
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      '&:hover': {
        bgcolor: alpha(color, 0.06),
      },
    }}
    onClick={onToggle}
    data-testid={testId}
  >
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flex: 1,
        minWidth: 0,
      }}
    >
      {icon}
      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
        {label}
      </Typography>
      {count !== undefined && count !== null && (
        <Chip
          label={count}
          size="small"
          sx={{
            bgcolor: alpha(color, 0.12),
            color,
            fontWeight: 700,
            fontSize: '0.75rem',
            height: 22,
            minWidth: 22,
          }}
        />
      )}
    </Box>
    {action && (
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        onClick={(event) => event.stopPropagation()}
      >
        {action}
      </Box>
    )}
    <IconButton
      size="small"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-label={`${label} ${open ? 'zuklappen' : 'aufklappen'}`}
    >
      {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
    </IconButton>
  </Box>
);

export default DetailSectionHeader;
