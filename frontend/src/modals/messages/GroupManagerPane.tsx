import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { apiJson } from '../../utils/api';
import { MessageGroup, User } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  groups: MessageGroup[];
  users: User[];
  onCreate: (group: MessageGroup) => void;
  onUpdate: (group: MessageGroup) => void;
  onDelete: (id: string) => void;
}

interface FormState {
  name: string;
  members: User[];
}

const EMPTY_FORM: FormState = { name: '', members: [] };

export const GroupManagerPane: React.FC<Props> = ({
  open, onClose, groups, users, onCreate, onUpdate, onDelete,
}) => {
  const [formOpen, setFormOpen]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [form, setForm]               = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [editLoading, setEditLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setError(null);
  };

  const openEdit = async (group: MessageGroup) => {
    setError(null);
    setEditLoading(group.id);
    try {
      const res = await apiJson(`/api/message-groups/${group.id}`);
      const full: MessageGroup = res.group;
      setEditingId(full.id);
      setForm({
        name: full.name,
        members: (full.members ?? []).map(
          (m) => users.find((u) => u.id === m.id) ?? m,
        ),
      });
      setFormOpen(true);
    } catch {
      setError('Fehler beim Laden der Gruppendetails.');
    } finally {
      setEditLoading(null);
    }
  };

  const cancelForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Bitte einen Gruppennamen eingeben.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = { name: form.name.trim(), memberIds: form.members.map((m) => m.id) };
      if (editingId) {
        const res = await apiJson(`/api/message-groups/${editingId}`, { method: 'PUT', body });
        onUpdate(res.group);
      } else {
        const res = await apiJson('/api/message-groups', { method: 'POST', body });
        onCreate(res.group);
      }
      cancelForm();
    } catch {
      setError('Fehler beim Speichern der Gruppe.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group: MessageGroup) => {
    setDeleteLoading(group.id);
    setError(null);
    try {
      await apiJson(`/api/message-groups/${group.id}`, { method: 'DELETE' });
      onDelete(group.id);
    } catch {
      setError('Fehler beim Löschen der Gruppe.');
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Empfängergruppen verwalten</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}

        {!formOpen && (
          <Button startIcon={<AddIcon />} onClick={openCreate} size="small" sx={{ mb: 1.5 }}>
            Neue Gruppe
          </Button>
        )}

        {formOpen && (
          <Box sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              {editingId ? 'Gruppe bearbeiten' : 'Neue Gruppe erstellen'}
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label="Gruppenname" size="small" fullWidth required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
              <Autocomplete
                multiple
                options={users}
                getOptionLabel={(u) => (u.context ? `${u.fullName} (${u.context})` : u.fullName)}
                value={form.members}
                onChange={(_, v) => setForm((f) => ({ ...f, members: v }))}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => <TextField {...params} label="Mitglieder" size="small" />}
                renderValue={(tags, getItemProps) =>
                  tags.map((o, i) => (
                    <Chip {...getItemProps({ index: i })} key={o.id} size="small" label={o.fullName} />
                  ))
                }
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" size="small" onClick={cancelForm} disabled={saving}>
                  Abbrechen
                </Button>
                <Button
                  variant="contained" size="small" onClick={handleSave} disabled={saving}
                  startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
                >
                  {saving ? 'Speichern…' : 'Speichern'}
                </Button>
              </Box>
            </Stack>
          </Box>
        )}

        {groups.length === 0 ? (
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            Noch keine Gruppen vorhanden.
          </Typography>
        ) : (
          <List dense disablePadding>
            {groups.map((g, i) => (
              <React.Fragment key={g.id}>
                {i > 0 && <Divider component="li" />}
                <ListItem
                  disableGutters
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => openEdit(g)}
                        disabled={!!editLoading || !!deleteLoading || formOpen}
                        aria-label={`${g.name} bearbeiten`}
                      >
                        {editLoading === g.id
                          ? <CircularProgress size={14} />
                          : <EditIcon fontSize="small" />
                        }
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(g)}
                        disabled={!!editLoading || !!deleteLoading || formOpen}
                        aria-label={`${g.name} löschen`}
                      >
                        {deleteLoading === g.id
                          ? <CircularProgress size={14} />
                          : <DeleteIcon fontSize="small" />
                        }
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={g.name}
                    secondary={`${g.memberCount} Mitglied${g.memberCount === 1 ? '' : 'er'}`}
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
};
