import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ShareIcon from '@mui/icons-material/Share';
import TuneIcon from '@mui/icons-material/Tune';
import type { QuickEventPreset } from './types';

interface PresetListProps {
  ownPresets: QuickEventPreset[];
  sharedPresets: QuickEventPreset[];
  loading: boolean;
  onEdit: (preset: QuickEventPreset) => void;
  onDelete: (preset: QuickEventPreset) => void;
  onActivate: (preset: QuickEventPreset) => void;
  onDeactivate: (preset: QuickEventPreset) => void;
  onAdd: () => void;
  onShare: (preset: QuickEventPreset) => void;
  onCopy: (preset: QuickEventPreset) => void;
  onRemoveShare: (preset: QuickEventPreset) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function OwnPresetRow({
  preset,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  onShare,
  onCopy,
}: {
  preset: QuickEventPreset;
  onEdit: (p: QuickEventPreset) => void;
  onDelete: (p: QuickEventPreset) => void;
  onActivate: (p: QuickEventPreset) => void;
  onDeactivate: (p: QuickEventPreset) => void;
  onShare: (p: QuickEventPreset) => void;
  onCopy: (p: QuickEventPreset) => void;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderColor: preset.isActive ? 'success.main' : 'divider',
        bgcolor: preset.isActive ? 'success.light' : undefined,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography fontWeight={600} noWrap>
            {preset.name}
          </Typography>
          {preset.isActive && (
            <Chip icon={<CheckCircleIcon />} label="Aktiv" size="small" color="success" />
          )}
          {preset.sharedWithUserIds.length > 0 && (
            <Chip
              icon={<PeopleAltIcon />}
              label={`Geteilt (${preset.sharedWithUserIds.length})`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {preset.config.buttons?.length ?? 0} Buttons · Geändert {formatDate(preset.updatedAt)}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        {preset.isActive ? (
          <Tooltip title="Deaktivieren">
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<RadioButtonUncheckedIcon />}
              onClick={() => onDeactivate(preset)}
            >
              Deaktivieren
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title="Als aktive Konfiguration setzen">
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={() => onActivate(preset)}
            >
              Aktivieren
            </Button>
          </Tooltip>
        )}
        <Tooltip title="Teilen">
          <IconButton size="small" onClick={() => onShare(preset)} aria-label={`Teilen: ${preset.name}`}>
            <ShareIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Kopieren">
          <IconButton size="small" onClick={() => onCopy(preset)} aria-label={`Kopieren: ${preset.name}`}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Bearbeiten">
          <IconButton size="small" onClick={() => onEdit(preset)} aria-label={`Bearbeiten: ${preset.name}`}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Löschen">
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(preset)}
            aria-label={`Löschen: ${preset.name}`}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}

function SharedPresetRow({
  preset,
  onEdit,
  onCopy,
  onRemoveShare,
}: {
  preset: QuickEventPreset;
  onEdit: (p: QuickEventPreset) => void;
  onCopy: (p: QuickEventPreset) => void;
  onRemoveShare: (p: QuickEventPreset) => void;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={600} noWrap>
          {preset.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {preset.config.buttons?.length ?? 0} Buttons · Geändert {formatDate(preset.updatedAt)}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        <Tooltip title="Kopieren und bearbeiten (erstellt eine eigene Kopie)">
          <IconButton size="small" onClick={() => onEdit(preset)} aria-label={`Bearbeiten: ${preset.name}`}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Als Kopie übernehmen">
          <IconButton size="small" onClick={() => onCopy(preset)} aria-label={`Kopieren: ${preset.name}`}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Aus geteilten entfernen">
          <IconButton
            size="small"
            color="error"
            onClick={() => onRemoveShare(preset)}
            aria-label={`Freigabe entfernen: ${preset.name}`}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}

export function PresetList({
  ownPresets,
  sharedPresets,
  loading,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  onAdd,
  onShare,
  onCopy,
  onRemoveShare,
}: PresetListProps) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (ownPresets.length === 0 && sharedPresets.length === 0) {
    return (
      <Box
        mt={4}
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap={2}
        sx={{ color: 'text.secondary' }}
      >
        <TuneIcon sx={{ fontSize: 72, opacity: 0.25 }} />
        <Typography variant="h6" color="text.secondary">
          Noch keine Konfigurationen vorhanden
        </Typography>
        <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth={420}>
          Erstelle deine erste Quick-Event-Konfiguration – lege Buttons für häufige Ereignisse fest und aktiviere sie für das Quick-Event-Panel.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
          Erste Konfiguration erstellen
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {ownPresets.map((preset) => (
        <OwnPresetRow
          key={preset.id}
          preset={preset}
          onEdit={onEdit}
          onDelete={onDelete}
          onActivate={onActivate}
          onDeactivate={onDeactivate}
          onShare={onShare}
          onCopy={onCopy}
        />
      ))}

      {sharedPresets.length > 0 && (
        <>
          <Divider sx={{ my: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Mit mir geteilt
            </Typography>
          </Divider>
          {sharedPresets.map((preset) => (
            <SharedPresetRow
              key={preset.id}
              preset={preset}
              onEdit={onEdit}
              onCopy={onCopy}
              onRemoveShare={onRemoveShare}
            />
          ))}
        </>
      )}
    </Box>
  );
}
