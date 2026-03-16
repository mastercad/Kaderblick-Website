import React, { useState } from 'react';
import {
  Button, TextField, MenuItem, Select, InputLabel, FormControl, Alert,
  Stack, Typography, Box,
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';
import RichTextEditor from '../components/RichTextEditor';
import NewsTemplatePicker from '../components/NewsTemplatePicker';

interface Club { id: number; name: string; }
interface Team { id: number; name: string; }
interface VisibilityOption { label: string; value: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clubs: Club[];
  teams: Team[];
  visibilityOptions: VisibilityOption[];
}

const NewsCreateModal: React.FC<Props> = ({ open, onClose, onSuccess, clubs, teams, visibilityOptions }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('platform');
  const [clubId, setClubId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reset = () => {
    setTitle('');
    setContent('');
    setVisibility('platform');
    setClubId('');
    setTeamId('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || content === '<p></p>') {
      setError('Bitte füge einen Inhalt hinzu.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: any = { title, content, visibility };
      if (visibility === 'club') payload.club_id = clubId;
      if (visibility === 'team') payload.team_id = teamId;
      const res = await apiJson('/news/create', { method: 'POST', body: payload });
      const data = res as { success?: boolean; error?: string };
      if (data.success) {
        reset();
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Fehler beim Senden');
      }
    } catch (e) {
      setError('Fehler beim Senden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      maxWidth="md"
      title="Neuigkeit erstellen"
      actions={
        <>
          <Button onClick={onClose} variant="outlined" color="secondary" disabled={loading}>Abbrechen</Button>
          <Button type="submit" form="newsCreateForm" variant="contained" color="primary" disabled={loading}
            sx={{ minWidth: 120 }}>
            {loading ? 'Wird gesendet…' : 'Veröffentlichen'}
          </Button>
        </>
      }
    >
      <form id="newsCreateForm" onSubmit={handleSubmit}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Titel */}
        <TextField
          label="Titel der Neuigkeit"
          value={title}
          onChange={e => setTitle(e.target.value)}
          fullWidth
          required
          sx={{ mt: 1, mb: 2 }}
          placeholder="Worum geht es?"
          inputProps={{ maxLength: 200 }}
        />

        {/* Rich Text Editor */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              Inhalt
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              startIcon={<AutoAwesomeIcon sx={{ fontSize: '0.95rem !important' }} />}
              onClick={() => setPickerOpen(true)}
              disabled={loading}
              sx={{ fontSize: '0.72rem', py: 0.25, px: 1 }}
            >
              Vorlage
            </Button>
          </Stack>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Schreibe hier deine Neuigkeit – mit Überschriften, Listen, Bildern, Links …"
            minHeight={280}
            disabled={loading}
          />
        </Box>

        {/* Sichtbarkeit */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth required>
            <InputLabel id="visibility-label">Sichtbarkeit</InputLabel>
            <Select
              labelId="visibility-label"
              value={visibility}
              label="Sichtbarkeit"
              onChange={e => setVisibility(e.target.value)}
            >
              <MenuItem value="platform"><Stack direction="row" spacing={1} alignItems="center"><PublicIcon fontSize="small" /><span>Plattform</span></Stack></MenuItem>
              <MenuItem value="club"><Stack direction="row" spacing={1} alignItems="center"><BusinessIcon fontSize="small" /><span>Verein</span></Stack></MenuItem>
              <MenuItem value="team"><Stack direction="row" spacing={1} alignItems="center"><GroupsIcon fontSize="small" /><span>Team</span></Stack></MenuItem>
            </Select>
          </FormControl>

          {visibility === 'club' && (
            <FormControl fullWidth required>
              <InputLabel id="club-label">Verein</InputLabel>
              <Select
                labelId="club-label"
                value={clubId}
                label="Verein"
                onChange={e => setClubId(e.target.value)}
              >
                <MenuItem value="">Bitte wählen…</MenuItem>
                {clubs.map(club => (
                  <MenuItem key={club.id} value={club.id}>{club.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {visibility === 'team' && (
            <FormControl fullWidth required>
              <InputLabel id="team-label">Team</InputLabel>
              <Select
                labelId="team-label"
                value={teamId}
                label="Team"
                onChange={e => setTeamId(e.target.value)}
              >
                <MenuItem value="">Bitte wählen…</MenuItem>
                {teams.map(team => (
                  <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </form>

      <NewsTemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onApply={html => setContent(html)}
        hasContent={!!content && content !== '<p></p>'}
      />
    </BaseModal>
  );
};

export default NewsCreateModal;
