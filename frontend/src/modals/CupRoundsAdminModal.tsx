import React, { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment, TextField, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import { apiJson } from '../utils/api';
import { CupRound, fetchCupRounds } from '../services/cupRounds';
import BaseModal from './BaseModal';

interface CupRoundsAdminModalProps {
    open: boolean;
    onClose: () => void;
}

const CupRoundsAdminModal: React.FC<CupRoundsAdminModalProps> = ({ open, onClose }) => {
    const [rounds, setRounds] = useState<CupRound[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);
    // inline edit state: which round is being edited + current input value
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState('');

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setError(null);
        fetchCupRounds()
            .then(setRounds)
            .catch(() => setError('Fehler beim Laden der Rundennamen.'))
            .finally(() => setLoading(false));
    }, [open]);

    const handleAdd = async () => {
        const name = newName.trim();
        if (!name) return;
        setSaving(true);
        setError(null);
        try {
            const res = await apiJson<{ round: CupRound }>('/api/cup-rounds', {
                method: 'POST',
                body: { name },
            });
            setRounds(prev => [...prev, res.round].sort((a, b) => a.name.localeCompare(b.name)));
            setNewName('');
        } catch (err: any) {
            setError(err?.message || 'Fehler beim Hinzufügen.');
        } finally {
            setSaving(false);
        }
    };

    const handleStartEdit = (r: CupRound) => {
        setEditingId(r.id);
        setEditingValue(r.name);
        setError(null);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingValue('');
    };

    const handleSaveEdit = async (id: number) => {
        const name = editingValue.trim();
        if (!name) return;
        setSaving(true);
        setError(null);
        try {
            const res = await apiJson<{ round: CupRound; gamesUpdated: number }>(`/api/cup-rounds/${id}`, {
                method: 'PUT',
                body: { name },
            });
            setRounds(prev =>
                prev.map(r => r.id === id ? res.round : r).sort((a, b) => a.name.localeCompare(b.name))
            );
            if (res.gamesUpdated > 0) {
                setError(`Umbenennung erfolgreich. ${res.gamesUpdated} Spiel${res.gamesUpdated === 1 ? '' : 'e'} aktualisiert.`);
            }
            setEditingId(null);
            setEditingValue('');
        } catch (err: any) {
            setError(err?.message || 'Fehler beim Speichern.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (r: CupRound) => {
        setError(null);
        try {
            await apiJson(`/api/cup-rounds/${r.id}`, { method: 'DELETE' });
            setRounds(prev => prev.filter(x => x.id !== r.id));
        } catch (err: any) {
            // 409 = in use
            setError(err?.message || `"${r.name}" kann nicht gelöscht werden.`);
        }
    };

    return (
        <BaseModal open={open} onClose={onClose} maxWidth="sm" title="Rundennamen verwalten">
            {loading ? (
                <Box display="flex" alignItems="center" justifyContent="center" minHeight={150}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {error && (
                        <Alert
                            severity={error.startsWith('Umbenennung') ? 'success' : 'error'}
                            sx={{ mb: 2 }}
                            onClose={() => setError(null)}
                        >
                            {error}
                        </Alert>
                    )}

                    {/* Inline-edit row */}
                    {editingId !== null && (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                            <TextField
                                size="small"
                                fullWidth
                                autoFocus
                                label="Rundenname bearbeiten"
                                value={editingValue}
                                onChange={e => setEditingValue(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveEdit(editingId);
                                    if (e.key === 'Escape') handleCancelEdit();
                                }}
                                disabled={saving}
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton size="small" aria-label="Speichern" onClick={() => handleSaveEdit(editingId)} disabled={!editingValue.trim() || saving}>
                                                    <CheckIcon fontSize="small" color="success" />
                                                </IconButton>
                                                <IconButton size="small" aria-label="Abbrechen" onClick={handleCancelEdit} disabled={saving}>
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                            />
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2, minHeight: 40 }}>
                        {rounds.length === 0 && (
                            <Box sx={{ color: 'text.secondary', fontSize: 14 }}>Noch keine Rundennamen vorhanden.</Box>
                        )}
                        {rounds.map(r => (
                            <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <Chip
                                    label={r.name}
                                    size="small"
                                    color={editingId === r.id ? 'primary' : 'default'}
                                    onDelete={() => handleDelete(r)}
                                />
                                <Tooltip title="Umbenennen">
                                    <IconButton size="small" onClick={() => handleStartEdit(r)}>
                                        <EditIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        ))}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <TextField
                            label="Neuer Rundenname"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { handleAdd(); e.preventDefault(); } }}
                            size="small"
                            fullWidth
                            disabled={saving}
                        />
                        <Button
                            onClick={handleAdd}
                            disabled={!newName.trim() || saving}
                            variant="outlined"
                            size="small"
                            sx={{ whiteSpace: 'nowrap', mt: 0.5 }}
                            startIcon={saving ? <CircularProgress size={14} /> : <AddIcon />}
                        >
                            Hinzufügen
                        </Button>
                    </Box>

                    <Box display="flex" justifyContent="flex-end" mt={3} mb={1}>
                        <Button onClick={onClose} variant="contained">Schließen</Button>
                    </Box>
                </>
            )}
        </BaseModal>
    );
};

export default CupRoundsAdminModal;
