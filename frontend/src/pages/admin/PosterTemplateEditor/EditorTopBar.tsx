import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { POSTER_TYPE_OPTIONS, FORMAT_OPTIONS } from './helpers';
import type { EditorTopBarProps } from './types';

export default function EditorTopBar({
  name, posterType, supportedFormats, activeFormat, isDirty, saving,
  onNameChange, onTypeChange, onFormatToggle, onFormatPreview, onPreviewOpen, onSave, onBack,
}: EditorTopBarProps) {
  return (
    <Paper
      square
      elevation={2}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, zIndex: 100, flexShrink: 0 }}
    >
      <Tooltip title="Zurück zur Liste">
        <IconButton onClick={onBack} size="small">
          <ArrowBackIcon />
        </IconButton>
      </Tooltip>
      <TextField
        label="Name"
        size="small"
        value={name}
        onChange={e => onNameChange(e.target.value)}
        sx={{ minWidth: 220 }}
      />
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Typ</InputLabel>
        <Select value={posterType} label="Typ" onChange={e => onTypeChange(e.target.value as any)}>
          {POSTER_TYPE_OPTIONS.map(o => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Divider orientation="vertical" flexItem />
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            mr: 0.5
          }}>Formate:</Typography>
        {FORMAT_OPTIONS.map(fmt => (
          <Chip
            key={fmt}
            label={fmt}
            clickable
            size="small"
            color={supportedFormats.includes(fmt) ? 'primary' : 'default'}
            variant={supportedFormats.includes(fmt) ? 'filled' : 'outlined'}
            onClick={() => onFormatToggle(fmt)}
          />
        ))}
      </Box>
      {supportedFormats.length > 1 && (
        <>
          <Divider orientation="vertical" flexItem />
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                mr: 0.5
              }}>Ansicht:</Typography>
            {FORMAT_OPTIONS.filter(f => supportedFormats.includes(f)).map(fmt => (
              <Chip
                key={fmt}
                label={fmt}
                clickable
                size="small"
                color={activeFormat === fmt ? 'secondary' : 'default'}
                variant={activeFormat === fmt ? 'filled' : 'outlined'}
                onClick={() => onFormatPreview(fmt)}
              />
            ))}
          </Box>
        </>
      )}
      <Box sx={{ flex: 1 }} />
      {isDirty && (
        <Typography
          variant="caption"
          sx={{
            color: "warning.main",
            mr: 1
          }}>
          Ungespeicherte Änderungen
        </Typography>
      )}
      <Tooltip title="Vorschau mit Beispieldaten">
        <IconButton onClick={onPreviewOpen} size="small">
          <VisibilityIcon />
        </IconButton>
      </Tooltip>
      <Button
        variant="contained"
        color="primary"
        startIcon={saving ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SaveIcon />}
        onClick={onSave}
        disabled={saving}
      >
        Speichern
      </Button>
    </Paper>
  );
}
