import React, { useEffect, useState } from 'react';
import {
    Button, Box, TextField, CircularProgress, Alert, Divider
} from '@mui/material';
import { League } from '../types/league';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';

interface LeagueEditModalProps {
    openLeagueEditModal: boolean;
    leagueId: number | null;
    onLeagueEditModalClose: () => void;
    onLeagueSaved?: (league: League) => void;
}

const LeagueEditModal: React.FC<LeagueEditModalProps> = ({ openLeagueEditModal, leagueId, onLeagueEditModalClose, onLeagueSaved }) => {
    const [league, setLeague] = useState<League | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (openLeagueEditModal && leagueId) {
            setLoading(true);
            apiJson<{ league: League }>(`/api/leagues/${leagueId}`)
                .then(data => {
                    setLeague(data.league);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Positionsdaten.');
                    setLoading(false);
                });
        } else if (openLeagueEditModal) {
            setLeague(null);
        }
    }, [openLeagueEditModal, leagueId]);

    const handleLeagueEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLeague((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleLeagueEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const url = league!.id ? `/api/leagues/${league!.id}` : '/api/leagues';
          const method = league!.id ? 'PUT' : 'POST';
          const res = await apiJson(url, {
            method,
            body: league,
            headers: { 'Content-Type': 'application/json' },
          });

          if (onLeagueSaved) onLeagueSaved(res.league || res.data || league);
          onLeagueEditModalClose();
        } catch (err: any) {
          setError(err?.message || 'Fehler beim Speichern');
        } finally {
          setLoading(false);
        }
    };

    return (
        <BaseModal
            open={openLeagueEditModal}
            onClose={onLeagueEditModalClose}
            maxWidth="xs"
            title="Liga bearbeiten"
        >
            {loading ? (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 200
                        }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : (
                    <form id="leagueEditForm" autoComplete="off" onSubmit={handleLeagueEditSubmit}>
                        <input type="hidden" name="id" value={league?.id} />
                        <Box sx={{ bgcolor: 'background.default', p: 0 }}>
                            <Box sx={{
                                mb: 2
                            }}>
                                <TextField label="Name" name="name" value={league?.name || ''} onChange={handleLeagueEditChange} required fullWidth margin="normal" />
                                <TextField label="Kurzname" name="code" value={league?.code || ''} onChange={handleLeagueEditChange} fullWidth margin="normal" />
                            </Box>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 2,
                                mt: 3,
                                mb: 1
                            }}>
                            <Button onClick={onLeagueEditModalClose} variant="outlined" color="secondary">
                                Abbrechen
                            </Button>
                            <Button type="submit" variant="contained" color="primary" disabled={saving}>
                                {saving ? <CircularProgress size={20} /> : 'Speichern'}
                            </Button>
                        </Box>
                    </form>
                )}
        </BaseModal>
    );
};

export default LeagueEditModal;
