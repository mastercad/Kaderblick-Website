import React from 'react';
import { Chip, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { CronJob } from './types';

interface Props {
  status: CronJob['status'];
}

export default function CronStatusChip({ status }: Props) {
  if (status === 'running') {
    return <Chip icon={<CircularProgress size={14} />} label="Läuft..." color="info" size="small" />;
  }
  if (status === 'ok') {
    return <Chip icon={<CheckCircleIcon />} label="OK" color="success" size="small" />;
  }
  if (status === 'late') {
    return <Chip icon={<WarningAmberIcon />} label="Überfällig" color="warning" size="small" />;
  }
  if (status === 'error') {
    return <Chip icon={<ErrorIcon />} label="Fehler" color="error" size="small" />;
  }
  return <Chip icon={<HelpOutlineIcon />} label="Unbekannt" size="small" />;
}
