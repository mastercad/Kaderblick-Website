import React, { useEffect, useState } from 'react';
import {
    Button, Box, TextField, CircularProgress, Alert
} from '@mui/material';
import { Camera } from '../types/camera';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';

interface CameraEditModalProps {
    openCameraEditModal: boolean;
    cameraId: number | null;
    onCameraEditModalClose: () => void;
    onCameraSaved?: (camera: Camera) => void;
}

const CameraEditModal: React.FC<CameraEditModalProps> = ({ openCameraEditModal, cameraId, onCameraEditModalClose, onCameraSaved }) => {
    const [camera, setCamera] = useState<Camera | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (openCameraEditModal && cameraId) {
            setLoading(true);
            apiJson<{ camera: Camera }>(`/api/cameras/${cameraId}`)
                .then(data => {
                    setCamera(data.camera);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Kameradaten.');
                    setLoading(false);
                });
        } else if (openCameraEditModal) {
            setCamera({ id: 0, name: '' });
        }
    }, [openCameraEditModal, cameraId]);

    const handleCameraEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCamera((prev: any) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCameraEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
          const url = camera!.id ? `/api/cameras/${camera!.id}` : '/api/cameras';
          const method = camera!.id ? 'PUT' : 'POST';
          const res = await apiJson(url, {
            method,
            body: camera,
            headers: { 'Content-Type': 'application/json' },
          });

          if (onCameraSaved) onCameraSaved(res.camera || res.data || camera);
          onCameraEditModalClose();
        } catch (err: any) {
          setError(err?.message || 'Fehler beim Speichern');
        } finally {
          setSaving(false);
        }
    };

    return (
        <BaseModal
            open={openCameraEditModal}
            onClose={onCameraEditModalClose}
            maxWidth="xs"
            title={cameraId ? "Kamera bearbeiten" : "Neue Kamera erstellen"}
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
                <form id="cameraEditForm" autoComplete="off" onSubmit={handleCameraEditSubmit}>
                    <input type="hidden" name="id" value={camera?.id} />
                    <Box sx={{ bgcolor: 'background.default', p: 0 }}>
                        <Box sx={{
                            mb: 2
                        }}>
                            <TextField 
                                label="Name" 
                                name="name" 
                                value={camera?.name || ''} 
                                onChange={handleCameraEditChange} 
                                required 
                                fullWidth 
                                margin="normal"
                                helperText="z.B. DJI Osmo Action 5 Pro" 
                            />
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
                        <Button onClick={onCameraEditModalClose} variant="outlined" color="secondary">
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

export default CameraEditModal;
