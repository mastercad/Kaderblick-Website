import React, { useEffect, useState } from 'react';
import {
    Button, Box, TextField, CircularProgress, Alert
} from '@mui/material';
import { SurfaceType } from '../types/surfaceType';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';

interface SurfaceTypeEditModalProps {
    openSurfaceTypeEditModal: boolean;
    surfaceTypeId: number | null;
    onSurfaceTypeEditModalClose: () => void;
    onSurfaceTypeSaved?: (surfaceType: SurfaceType) => void;
}

const SurfaceTypeEditModal: React.FC<SurfaceTypeEditModalProps> = ({ openSurfaceTypeEditModal, surfaceTypeId, onSurfaceTypeEditModalClose, onSurfaceTypeSaved }) => {
    const [surfaceType, setSurfaceType] = useState<SurfaceType | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (openSurfaceTypeEditModal && surfaceTypeId) {
            setLoading(true);
            apiJson<{ surfaceType: SurfaceType }>(`/api/surface-types/${surfaceTypeId}`)
                .then(data => {
                    setSurfaceType(data.surfaceType);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Positionsdaten.');
                    setLoading(false);
                });
        } else if (openSurfaceTypeEditModal) {
            setSurfaceType(null);
        }
    }, [openSurfaceTypeEditModal, surfaceTypeId]);

    const handleSurfaceTypeEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSurfaceType((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSurfaceTypeEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const url = surfaceType!.id ? `/api/surface-types/${surfaceType!.id}` : '/api/surface-types';
          const method = surfaceType!.id ? 'PUT' : 'POST';
          const res = await apiJson(url, {
            method,
            body: surfaceType,
            headers: { 'Content-Type': 'application/json' },
          });

          if (onSurfaceTypeSaved) onSurfaceTypeSaved(res.surfaceType || res.data || surfaceType);
          onSurfaceTypeEditModalClose();
        } catch (err: any) {
          setError(err?.message || 'Fehler beim Speichern');
        } finally {
          setLoading(false);
        }
    };

    return (
        <BaseModal
            open={openSurfaceTypeEditModal}
            onClose={onSurfaceTypeEditModalClose}
            maxWidth="xs"
            title="Spielfeldoberfläche bearbeiten"
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
                <form id="surfaceTypeEditForm" autoComplete="off" onSubmit={handleSurfaceTypeEditSubmit}>
                    <input type="hidden" name="id" value={surfaceType?.id} />
                    <Box sx={{ bgcolor: 'background.default', p: 0 }}>
                        <Box sx={{
                            mb: 2
                        }}>
                            <TextField label="Name" name="name" value={surfaceType?.name || ''} onChange={handleSurfaceTypeEditChange} required fullWidth margin="normal" />
                            <TextField label="Beschreibung" name="description" value={surfaceType?.description || ''} onChange={handleSurfaceTypeEditChange} fullWidth margin="normal" />
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
                        <Button onClick={onSurfaceTypeEditModalClose} variant="outlined" color="secondary">
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

export default SurfaceTypeEditModal;
