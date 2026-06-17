import { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { apiJson, getApiErrorMessage } from '../utils/api';

interface PenaltyTypeOption {
  id: number;
  name: string;
  amount: number;
  isPositive: boolean;
}

interface PlayerOption {
  userId: number;
  name: string;
}

interface TeamOption {
  id: number;
  name: string;
}

interface AssignPenaltyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedTeamId?: number;
  preselectedUserId?: number;
}

export default function AssignPenaltyDialog({ open, onClose, onSuccess, preselectedTeamId, preselectedUserId }: AssignPenaltyDialogProps) {
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [penaltyTypes, setPenaltyTypes] = useState<PenaltyTypeOption[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [teamId, setTeamId] = useState<number | ''>('');
  const [userId, setUserId] = useState<number | ''>('');
  const [penaltyTypeId, setPenaltyTypeId] = useState<number | ''>('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiJson('/api/penalty/catalog').then((data: any) => {
      setTeams(data.teams ?? []);
      const active = (data.catalog ?? []).filter((c: any) => c.active);
      setPenaltyTypes(active);
    });
  }, [open]);

  useEffect(() => {
    if (open && preselectedTeamId) setTeamId(preselectedTeamId);
  }, [open, preselectedTeamId]);

  useEffect(() => {
    if (open && preselectedUserId) setUserId(preselectedUserId);
  }, [open, preselectedUserId]);

  const loadPlayers = useCallback(async (tid: number) => {
    setLoadingPlayers(true);
    try {
      const data: any = await apiJson(`/api/penalty/team-players/${tid}`);
      setPlayers(data.players ?? []);
    } catch {
      setPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  }, []);

  useEffect(() => {
    if (teamId) loadPlayers(teamId as number);
    else setPlayers([]);
  }, [teamId, loadPlayers]);

  const handleClose = () => {
    setTeamId('');
    setUserId('');
    setPenaltyTypeId('');
    setNote('');
    setEntryDate(new Date().toISOString().slice(0, 10));
    setError('');
    onClose();
  };

  const selectedType = penaltyTypes.find(t => t.id === penaltyTypeId);
  const fines = penaltyTypes.filter(t => !t.isPositive);
  const rewards = penaltyTypes.filter(t => t.isPositive);

  const handleSubmit = async () => {
    if (!teamId || !userId || !penaltyTypeId) {
      setError('Bitte Team, Spieler und Strafentyp auswählen.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiJson('/api/penalty/assign', {
        method: 'POST',
        body: { penaltyTypeId, userId, teamId, note: note || undefined, entryDate },
      });
      handleClose();
      onSuccess?.();
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const selectedPlayer = players.find(p => p.userId === userId);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Strafe / Belohnung vergeben</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}

        <FormControl fullWidth size="small">
          <InputLabel>Team</InputLabel>
          <Select label="Team" value={teamId} onChange={e => { setTeamId(e.target.value as number); setUserId(''); }}>
            {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" disabled={!teamId || loadingPlayers}>
          <InputLabel>Spieler</InputLabel>
          <Select label="Spieler" value={userId} onChange={e => setUserId(e.target.value as number)}>
            {loadingPlayers && <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> Laden…</MenuItem>}
            {players.map(p => <MenuItem key={p.userId} value={p.userId}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Strafentyp</InputLabel>
          <Select label="Strafentyp" value={penaltyTypeId} onChange={e => setPenaltyTypeId(e.target.value as number)}>
            {fines.length > 0 && <ListSubheader sx={{ color: 'error.main', fontWeight: 700 }}>Strafen</ListSubheader>}
            {fines.map(t => (
              <MenuItem key={t.id} value={t.id} sx={{ color: 'error.main' }}>
                {t.name} ({t.amount.toFixed(2)} €)
              </MenuItem>
            ))}
            {rewards.length > 0 && <ListSubheader sx={{ color: 'success.main', fontWeight: 700 }}>Belohnungen</ListSubheader>}
            {rewards.map(t => (
              <MenuItem key={t.id} value={t.id} sx={{ color: 'success.main' }}>
                {t.name} (+{t.amount.toFixed(2)} €)
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField label="Datum" type="date" size="small" fullWidth value={entryDate} onChange={e => setEntryDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Notiz (optional)" size="small" fullWidth value={note} onChange={e => setNote(e.target.value)} />

        {selectedType && selectedPlayer && (
          <Box sx={{ p: 1.5, bgcolor: selectedType.isPositive ? 'success.50' : 'error.50', borderRadius: 2, border: 1, borderColor: selectedType.isPositive ? 'success.200' : 'error.200' }}>
            <Typography variant="body2">
              <strong>{selectedPlayer.name}</strong> erhält{' '}
              {selectedType.isPositive ? 'Belohnung' : 'Strafe'}:{' '}
              <strong>{selectedType.name}</strong> ({selectedType.isPositive ? '+' : '-'}{selectedType.amount.toFixed(2)} €)
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Abbrechen</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || !teamId || !userId || !penaltyTypeId}>
          {saving ? <CircularProgress size={20} /> : 'Vergeben'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
