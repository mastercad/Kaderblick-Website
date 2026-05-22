import React, { useEffect, useState } from 'react';
import {
    Button, Box, TextField, CircularProgress, Alert
} from '@mui/material';
import { Nationality } from '../types/nationality';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';

interface NationalityEditModalProps {
    openNationalityEditModal: boolean;
    nationalityId: number | null;
    onNationalityEditModalClose: () => void;
    onNationalitySaved?: (nationality: Nationality) => void;
}

const NationalityEditModal: React.FC<NationalityEditModalProps> = ({ openNationalityEditModal, nationalityId, onNationalityEditModalClose, onNationalitySaved }) => {
    const [nationality, setNationality] = useState<Nationality | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (openNationalityEditModal && nationalityId) {
            setLoading(true);
            apiJson<{ nationality: Nationality }>(`/api/nationalities/${nationalityId}`)
                .then(data => {
                    setNationality(data.nationality);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Positionsdaten.');
                    setLoading(false);
                });
        } else if (openNationalityEditModal) {
            setNationality(null);
        }
    }, [openNationalityEditModal, nationalityId]);

    const handleNationalityEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setNationality((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleNationalityEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const url = nationality!.id ? `/api/nationalities/${nationality!.id}` : '/api/nationalities';
          const method = nationality!.id ? 'PUT' : 'POST';
          const res = await apiJson(url, {
            method,
            body: nationality,
            headers: { 'Content-Type': 'application/json' },
          });

          if (onNationalitySaved) onNationalitySaved(res.nationality || res.data || nationality);
          onNationalityEditModalClose();
        } catch (err: any) {
          setError(err?.message || 'Fehler beim Speichern');
        } finally {
          setLoading(false);
        }
    };

    return (
        <BaseModal
            open={openNationalityEditModal}
            onClose={onNationalityEditModalClose}
            maxWidth="xs"
            title="Nationalität bearbeiten"
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
                <form id="nationalityEditForm" autoComplete="off" onSubmit={handleNationalityEditSubmit}>
                    <input type="hidden" name="id" value={nationality?.id} />
                    <Box sx={{ bgcolor: 'background.default', p: 0 }}>
                        <Box sx={{
                            mb: 2
                        }}>
                            <TextField label="Name" name="name" value={nationality?.name || ''} onChange={handleNationalityEditChange} required fullWidth margin="normal" />
                            <TextField label="ISO Code" name="isoCode" value={nationality?.isoCode || ''} onChange={handleNationalityEditChange} fullWidth margin="normal" />
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
                        <Button onClick={onNationalityEditModalClose} variant="outlined" color="secondary">
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

export default NationalityEditModal;
