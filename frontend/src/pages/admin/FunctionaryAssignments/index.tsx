import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { apiJson, getApiErrorMessage } from '../../../utils/api';
import { AdminPageLayout } from '../../../components/AdminPageLayout';
import { useToast } from '../../../context/ToastContext';

interface RefItem { id: number; name: string }
interface UserRefItem { id: number; fullName: string }
interface TeamAssignment {
  id: number;
  user: UserRefItem | null;
  team: RefItem | null;
  type: RefItem | null;
  startDate: string | null;
  endDate: string | null;
}
interface ClubAssignment {
  id: number;
  user: UserRefItem | null;
  club: RefItem | null;
  type: RefItem | null;
  startDate: string | null;
  endDate: string | null;
}
interface PageData {
  teamAssignments: TeamAssignment[];
  clubAssignments: ClubAssignment[];
  users: UserRefItem[];
  teams: RefItem[];
  clubs: RefItem[];
  teamAssignmentTypes: RefItem[];
  clubAssignmentTypes: RefItem[];
}

type DialogMode = 'create-team' | 'edit-team' | 'create-club' | 'edit-club';

interface FormState {
  userId: number | '';
  teamId: number | '';
  clubId: number | '';
  typeId: number | '';
  startDate: string;
  endDate: string;
}

const emptyForm = (): FormState => ({ userId: '', teamId: '', clubId: '', typeId: '', startDate: '', endDate: '' });

const FunctionaryAssignments: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<{ id: number; kind: 'team' | 'club' } | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    apiJson('/admin/assignments/functionary')
      .then((d: any) => setData(d))
      .catch((e: any) => toast.showToast(getApiErrorMessage(e) || 'Fehler beim Laden', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = (kind: 'team' | 'club') => {
    setDialogMode(kind === 'team' ? 'create-team' : 'create-club');
    setEditId(null);
    setForm(emptyForm());
  };

  const openEdit = (kind: 'team' | 'club', row: TeamAssignment | ClubAssignment) => {
    setDialogMode(kind === 'team' ? 'edit-team' : 'edit-club');
    setEditId(row.id);
    setForm({
      userId: row.user?.id ?? '',
      teamId: kind === 'team' ? (row as TeamAssignment).team?.id ?? '' : '',
      clubId: kind === 'club' ? (row as ClubAssignment).club?.id ?? '' : '',
      typeId: row.type?.id ?? '',
      startDate: row.startDate ?? '',
      endDate: row.endDate ?? '',
    });
  };

  const handleSave = async () => {
    if (!dialogMode) return;
    setSaving(true);
    try {
      const isTeam = dialogMode.includes('team');
      const isCreate = dialogMode.includes('create');
      const url = isCreate
        ? `/admin/assignments/functionary/${isTeam ? 'team' : 'club'}`
        : `/admin/assignments/functionary/${isTeam ? 'team' : 'club'}/${editId}`;
      const body = {
        userId: form.userId || undefined,
        teamId: isTeam ? form.teamId || undefined : undefined,
        clubId: !isTeam ? form.clubId || undefined : undefined,
        typeId: form.typeId || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      await apiJson(url, { method: isCreate ? 'POST' : 'PUT', body: JSON.stringify(body) });
      toast.showToast(isCreate ? 'Zuordnung erstellt' : 'Zuordnung aktualisiert', 'success');
      setDialogMode(null);
      load();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiJson(`/admin/assignments/functionary/${deleteId.kind}/${deleteId.id}`, { method: 'DELETE' });
      toast.showToast('Zuordnung gelöscht', 'success');
      setDeleteId(null);
      load();
    } catch (e: any) {
      toast.showToast(getApiErrorMessage(e) || 'Fehler beim Löschen', 'error');
    }
  };

  const isTeamDialog = dialogMode?.includes('team') ?? false;

  return (
    <AdminPageLayout
      icon={<AccountBalanceIcon />}
      title="Funktionärs-Zuordnungen"
      loading={false}
      maxWidth={1200}
      filterControls={
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`Team-Funktionäre (${data?.teamAssignments.length ?? 0})`} />
          <Tab label={`Vereins-Funktionäre (${data?.clubAssignments.length ?? 0})`} />
        </Tabs>
      }
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => openCreate(tab === 0 ? 'team' : 'club')}>
              Zuordnung hinzufügen
            </Button>
          </Box>

          {tab === 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Benutzer</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell>Funktion</TableCell>
                    <TableCell>Von</TableCell>
                    <TableCell>Bis</TableCell>
                    <TableCell align="right">Aktionen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.teamAssignments.length === 0 && (
                    <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>Keine Einträge vorhanden</Typography></TableCell></TableRow>
                  )}
                  {data?.teamAssignments.map(row => (
                    <TableRow key={row.id} hover>
                      <TableCell><Typography variant="body2">{row.user?.fullName ?? '—'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{row.team?.name ?? '—'}</Typography></TableCell>
                      <TableCell>{row.type ? <Chip label={row.type.name} size="small" /> : <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                      <TableCell><Typography variant="body2">{row.startDate ?? '—'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{row.endDate ?? '—'}</Typography></TableCell>
                      <TableCell align="right">
                        <Tooltip title="Bearbeiten">
                          <IconButton size="small" onClick={() => openEdit('team', row)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen">
                          <IconButton size="small" color="error" onClick={() => setDeleteId({ id: row.id, kind: 'team' })}><DeleteOutlineIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tab === 1 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Benutzer</TableCell>
                    <TableCell>Verein</TableCell>
                    <TableCell>Funktion</TableCell>
                    <TableCell>Von</TableCell>
                    <TableCell>Bis</TableCell>
                    <TableCell align="right">Aktionen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.clubAssignments.length === 0 && (
                    <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>Keine Einträge vorhanden</Typography></TableCell></TableRow>
                  )}
                  {data?.clubAssignments.map(row => (
                    <TableRow key={row.id} hover>
                      <TableCell><Typography variant="body2">{row.user?.fullName ?? '—'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{row.club?.name ?? '—'}</Typography></TableCell>
                      <TableCell>{row.type ? <Chip label={row.type.name} size="small" /> : <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                      <TableCell><Typography variant="body2">{row.startDate ?? '—'}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{row.endDate ?? '—'}</Typography></TableCell>
                      <TableCell align="right">
                        <Tooltip title="Bearbeiten">
                          <IconButton size="small" onClick={() => openEdit('club', row)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen">
                          <IconButton size="small" color="error" onClick={() => setDeleteId({ id: row.id, kind: 'club' })}><DeleteOutlineIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={!!dialogMode} onClose={() => setDialogMode(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogMode?.includes('create') ? 'Funktionärs-Zuordnung hinzufügen' : 'Funktionärs-Zuordnung bearbeiten'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField select label="Benutzer" value={form.userId} onChange={e => setForm(f => ({ ...f, userId: Number(e.target.value) }))} fullWidth required>
            {(data?.users ?? []).map(u => <MenuItem key={u.id} value={u.id}>{u.fullName}</MenuItem>)}
          </TextField>
          {isTeamDialog ? (
            <TextField select label="Team" value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: Number(e.target.value) }))} fullWidth required>
              {(data?.teams ?? []).map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </TextField>
          ) : (
            <TextField select label="Verein" value={form.clubId} onChange={e => setForm(f => ({ ...f, clubId: Number(e.target.value) }))} fullWidth required>
              {(data?.clubs ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          )}
          <TextField select label="Funktion (optional)" value={form.typeId} onChange={e => setForm(f => ({ ...f, typeId: e.target.value === '' ? '' : Number(e.target.value) }))} fullWidth>
            <MenuItem value="">Keine</MenuItem>
            {(isTeamDialog ? (data?.teamAssignmentTypes ?? []) : (data?.clubAssignmentTypes ?? [])).map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </TextField>
          <TextField type="date" label="Von" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="Bis" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogMode(null)}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !form.userId || (!form.teamId && !form.clubId)}>
            {saving ? <CircularProgress size={18} /> : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle>Zuordnung löschen?</DialogTitle>
        <DialogContent>
          <Typography>Diese Funktionärs-Zuordnung wird unwiderruflich gelöscht.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Abbrechen</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Löschen</Button>
        </DialogActions>
      </Dialog>
    </AdminPageLayout>
  );
};

export default FunctionaryAssignments;
