import React, { useEffect, useState } from 'react';
import {
    Button, Box, TextField, CircularProgress, Alert
} from '@mui/material';
import { Cup } from '../types/cup';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';

interface CupEditModalProps {
    openCupEditModal: boolean;
    cupId: number | null;
    onCupEditModalClose: () => void;
    onCupSaved?: (cup: Cup) => void;
}

const CupEditModal: React.FC<CupEditModalProps> = ({ openCupEditModal, cupId, onCupEditModalClose, onCupSaved }) => {
    const [cup, setCup] = useState<Cup | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (openCupEditModal && cupId) {
            setLoading(true);
            apiJson<{ cup: Cup }>(`/api/cups/${cupId}`)
                .then(data => {
                    setCup(data.cup);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Pokaldaten.');
                    setLoading(false);
                });
        } else if (openCupEditModal) {
            setCup(null);
        }
    }, [openCupEditModal, cupId]);

    const handleCupEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCup((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleCupEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const url = cup?.id ? `/api/cups/${cup.id}` : '/api/cups';
            const method = cup?.id ? 'PUT' : 'POST';
            const res = await apiJson(url, {
                method,
                body: { name: cup?.name },
                headers: { 'Content-Type': 'application/json' },
            });

            if (onCupSaved) onCupSaved(res.cup || res.data || cup);
            onCupEditModalClose();
        } catch (err: any) {
            setError(err?.message || 'Fehler beim Speichern');
        } finally {
            setSaving(false);
        }
    };

    return (
        <BaseModal
            open={openCupEditModal}
            onClose={onCupEditModalClose}
            maxWidth="xs"
            title="Pokal bearbeiten"
        >
            {loading ? (
                <Box display="flex" alignItems="center" justifyContent="center" minHeight={200}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : (
                <form id="cupEditForm" autoComplete="off" onSubmit={handleCupEditSubmit}>
                    <input type="hidden" name="id" value={cup?.id} />
                    <Box sx={{ bgcolor: 'background.default', p: 0 }}>
                        <TextField
                            label="Name"
                            name="name"
                            value={cup?.name || ''}
                            onChange={handleCupEditChange}
                            required
                            fullWidth
                            margin="normal"
                        />
                    </Box>
                    <Box display="flex" justifyContent="flex-end" gap={2} mt={3} mb={1}>
                        <Button onClick={onCupEditModalClose} variant="outlined" color="secondary">
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

export default CupEditModal;
