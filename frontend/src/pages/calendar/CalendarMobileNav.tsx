import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TodayIcon from '@mui/icons-material/Today';
import moment from 'moment';

interface Props {
  view: string;
  date: Date;
  availableViews: string[];
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onNavigateToToday: () => void;
  onViewChange: (v: string) => void;
  getViewLabel: (v: string) => string;
}

export function CalendarMobileNav({
  view,
  date,
  availableViews,
  onNavigateBack,
  onNavigateForward,
  onNavigateToToday,
  onViewChange,
  getViewLabel,
}: Props) {
  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <IconButton onClick={onNavigateBack} size="small">
          <ArrowBackIcon />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ textAlign: 'center', flex: 1 }}>
          {moment(date).format(view === 'day' ? 'ddd, D. MMM YYYY' : 'MMMM YYYY')}
        </Typography>

        <IconButton onClick={onNavigateForward} size="small">
          <ArrowForwardIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
        <IconButton onClick={onNavigateToToday} size="small" title="Heute">
          <TodayIcon />
        </IconButton>

        <ButtonGroup variant="outlined" size="small">
          {availableViews.map(v => (
            <Button
              key={v}
              variant={view === v ? 'contained' : 'outlined'}
              onClick={() => onViewChange(v)}
              size="small"
            >
              {getViewLabel(v)}
            </Button>
          ))}
        </ButtonGroup>
      </Box>
    </Paper>
  );
}
