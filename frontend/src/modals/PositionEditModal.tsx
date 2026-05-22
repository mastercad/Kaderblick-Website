import React, { useEffect, useState } from 'react';
import {
    Button, Box, TextField, CircularProgress, Alert
} from '@mui/material';
import { Position } from '../types/position';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';

interface PositionEditModalProps {
    openPositionEditModal: boolean;
    positionId: number | null;
    onPositionEditModalClose: () => void;
    onPositionSaved?: (position: Position) => void;
}

const PositionEditModal: React.FC<PositionEditModalProps> = ({ openPositionEditModal, positionId, onPositionEditModalClose, onPositionSaved }) => {
    const [position, setPosition] = useState<Position | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (openPositionEditModal && positionId) {
            setLoading(true);
            apiJson<{ position: Position }>(`/api/positions/${positionId}`)
                .then(data => {
                    setPosition(data.position);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Positionsdaten.');
                    setLoading(false);
                });
        } else if (openPositionEditModal) {
            setPosition(null);
        }
    }, [openPositionEditModal, positionId]);

    const handlePositionEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setPosition((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handlePositionEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const url = position!.id ? `/api/positions/${position!.id}` : '/api/positions';
          const method = position!.id ? 'PUT' : 'POST';
          const res = await apiJson(url, {
            method,
            body: position,
            headers: { 'Content-Type': 'application/json' },
          });

          if (onPositionSaved) onPositionSaved(res.position || res.data || position);
          onPositionEditModalClose();
        } catch (err: any) {
          setError(err?.message || 'Fehler beim Speichern');
        } finally {
          setLoading(false);
        }
    };

    return (
        <BaseModal
            open={openPositionEditModal}
            onClose={onPositionEditModalClose}
            maxWidth="xs"
            title="Position bearbeiten"
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
                <form id="positionEditForm" autoComplete="off" onSubmit={handlePositionEditSubmit}>
                    <input type="hidden" name="id" value={position?.id} />
                    <Box sx={{ bgcolor: 'background.default', p: 0 }}>
                        <Box sx={{
                            mb: 2
                        }}>
                            <TextField label="Name" name="name" value={position?.name || ''} onChange={handlePositionEditChange} required fullWidth margin="normal" />
                            <TextField label="Kurzname" name="shortName" value={position?.shortName || ''} onChange={handlePositionEditChange} fullWidth margin="normal" />
                            <TextField label="Beschreibung" name="description" value={position?.description || ''} onChange={handlePositionEditChange} fullWidth margin="normal" multiline minRows={2} />
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
                        <Button onClick={onPositionEditModalClose} variant="outlined" color="secondary">
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

export default PositionEditModal;
