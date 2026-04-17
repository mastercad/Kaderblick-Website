import React from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import Divider from '@mui/material/Divider';
import { SelectOption } from '../../types/event';

// ========================
// Tournament Matches
// ========================

interface WizardStep2TournamentProps {
  tournamentMatches: any[];
  teams: SelectOption[];
  editingMatchId: string | number | null;
  editingMatchDraft: any;
  onAddMatch: () => void;
  onEditMatch: (match: any) => void;
  onSaveMatch: () => void;
  onCancelEdit: () => void;
  onDeleteMatch: (matchId: string | number) => void;
  setEditingMatchDraft: (draft: any) => void;
}

export const WizardStep2Tournament: React.FC<WizardStep2TournamentProps> = ({
  tournamentMatches,
  teams,
  editingMatchId,
  editingMatchDraft,
  onAddMatch,
  onEditMatch,
  onSaveMatch,
  onCancelEdit,
  onDeleteMatch,
  setEditingMatchDraft,
}) => {
  const matches = tournamentMatches || [];

  return (
    <Box>
      {/* Header row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SportsSoccerIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            Begegnungen
          </Typography>
          {matches.length > 0 && (
            <Typography
              component="span"
              variant="caption"
              sx={{
                ml: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: 10,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontWeight: 600,
              }}
            >
              {matches.length}
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAddMatch}
        >
          Neue Begegnung
        </Button>
      </Box>

      {matches.length === 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            textAlign: 'center',
            borderStyle: 'dashed',
            borderColor: 'divider',
            bgcolor: 'transparent',
          }}
        >
          <SportsSoccerIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary" variant="body2">
            Noch keine Begegnungen. Klicke auf "Neue Begegnung" oder generiere sie automatisch im vorherigen Schritt.
          </Typography>
        </Paper>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {matches.map((m: any, index: number) => (
          <Paper
            key={m.id}
            variant="outlined"
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              borderColor: editingMatchId === m.id ? 'primary.main' : 'divider',
              transition: 'border-color 0.2s',
            }}
          >
            {editingMatchId === m.id ? (
              <MatchEditForm
                draft={editingMatchDraft}
                teams={teams}
                onChange={setEditingMatchDraft}
                onSave={onSaveMatch}
                onCancel={onCancelEdit}
              />
            ) : (
              <MatchDisplay
                match={m}
                index={index}
                onEdit={() => onEditMatch(m)}
                onDelete={() => onDeleteMatch(m.id)}
              />
            )}
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

/** Inline match edit form */
const MatchEditForm: React.FC<{
  draft: any;
  teams: SelectOption[];
  onChange: (draft: any) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ draft, teams, onChange, onSave, onCancel }) => (
  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    {/* Teams row */}
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      <Autocomplete
        options={teams}
        getOptionLabel={(opt: any) => opt.label}
        value={teams.find(t => String(t.value) === String(draft?.homeTeamId)) || null}
        onChange={(_, nv) =>
          onChange((d: any) => ({ ...d, homeTeamId: nv?.value || '', homeTeamName: nv?.label || '' }))
        }
        renderInput={(params) => <TextField {...params} label="Heim-Team" size="small" />}
        sx={{ flex: 1, minWidth: 180 }}
      />
      <Autocomplete
        options={teams}
        getOptionLabel={(opt: any) => opt.label}
        value={teams.find(t => String(t.value) === String(draft?.awayTeamId)) || null}
        onChange={(_, nv) =>
          onChange((d: any) => ({ ...d, awayTeamId: nv?.value || '', awayTeamName: nv?.label || '' }))
        }
        renderInput={(params) => <TextField {...params} label="Auswärts-Team" size="small" />}
        sx={{ flex: 1, minWidth: 180 }}
      />
    </Box>

    {/* Scheduling row */}
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      <TextField
        label="Runde"
        size="small"
        value={draft?.round || ''}
        onChange={e => onChange((d: any) => ({ ...d, round: e.target.value }))}
        sx={{ width: 110 }}
      />
      <TextField
        label="Slot"
        size="small"
        value={draft?.slot || ''}
        onChange={e => onChange((d: any) => ({ ...d, slot: e.target.value }))}
        sx={{ width: 110 }}
      />
      <TextField
        label="Anpfiff (Datum & Uhrzeit)"
        type="datetime-local"
        size="small"
        value={draft?.scheduledAt ? draft.scheduledAt.slice(0, 16) : ''}
        onChange={e => onChange((d: any) => ({ ...d, scheduledAt: e.target.value ? `${e.target.value}:00` : '' }))}
        InputLabelProps={{ shrink: true }}
        sx={{ flex: 1, minWidth: 200 }}
      />
    </Box>

    <Divider />

    {/* Action buttons */}
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
      <Button size="small" variant="outlined" startIcon={<CloseIcon />} onClick={onCancel}>
        Abbrechen
      </Button>
      <Button size="small" variant="contained" color="primary" startIcon={<SaveIcon />} onClick={onSave}>
        Speichern
      </Button>
    </Box>
  </Box>
);

/** Match display row */
const MatchDisplay: React.FC<{
  match: any;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ match, index, onEdit, onDelete }) => {
  const label = match.stage
    ? `${match.stage}${match.group && !match.stage.includes('Gr.') ? ` (Gr. ${match.group})` : ''}`
    : `Runde ${match.round || '?'}${match.group ? ` (Gr. ${match.group})` : ''}`;

  const time = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1.25,
        gap: 1,
      }}
    >
      {/* Index badge */}
      <Typography
        variant="caption"
        sx={{
          minWidth: 24,
          height: 24,
          borderRadius: '50%',
          bgcolor: 'action.selected',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </Typography>

      {/* Match info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap fontWeight={500}>
          {match.homeTeamName || 'TBD'}
          <Box component="span" sx={{ mx: 0.75, color: 'text.secondary', fontWeight: 400 }}>vs</Box>
          {match.awayTeamName || 'TBD'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}{time ? ` · ${time} Uhr` : ''}
        </Typography>
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
        <Tooltip title="Bearbeiten">
          <IconButton size="small" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Löschen">
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};


