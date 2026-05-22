import React, { useEffect, useState } from 'react';
import {
    Button, Box, TextField, CircularProgress, Alert
} from '@mui/material';
import { VideoType } from '../types/videoType';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';

interface VideoTypeEditModalProps {
    openVideoTypeEditModal: boolean;
    videoTypeId: number | null;
    onVideoTypeEditModalClose: () => void;
    onVideoTypeSaved?: (videoType: VideoType) => void;
}

const VideoTypeEditModal: React.FC<VideoTypeEditModalProps> = ({ openVideoTypeEditModal, videoTypeId, onVideoTypeEditModalClose, onVideoTypeSaved }) => {
    const [videoType, setVideoType] = useState<VideoType | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (openVideoTypeEditModal && videoTypeId) {
            setLoading(true);
            apiJson<{ videoType: VideoType }>(`/api/video-types/${videoTypeId}`)
                .then(data => {
                    setVideoType(data.videoType);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Videotyp-Daten.');
                    setLoading(false);
                });
        } else if (openVideoTypeEditModal) {
            setVideoType({ id: 0, name: '', sort: 0 });
        }
    }, [openVideoTypeEditModal, videoTypeId]);

    const handleVideoTypeEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setVideoType((prev: any) => ({
            ...prev,
            [name]: name === 'sort' ? parseInt(value) || 0 : value
        }));
    };

    const handleVideoTypeEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
          const url = videoType!.id ? `/api/video-types/${videoType!.id}` : '/api/video-types';
          const method = videoType!.id ? 'PUT' : 'POST';
          const res = await apiJson(url, {
            method,
            body: videoType,
            headers: { 'Content-Type': 'application/json' },
          });

          if (onVideoTypeSaved) onVideoTypeSaved(res.videoType || res.data || videoType);
          onVideoTypeEditModalClose();
        } catch (err: any) {
          setError(err?.message || 'Fehler beim Speichern');
        } finally {
          setSaving(false);
        }
    };

    return (
        <BaseModal
            open={openVideoTypeEditModal}
            onClose={onVideoTypeEditModalClose}
            maxWidth="xs"
            title={videoTypeId ? "Videotyp bearbeiten" : "Neuen Videotyp erstellen"}
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
                <form id="videoTypeEditForm" autoComplete="off" onSubmit={handleVideoTypeEditSubmit}>
                    <input type="hidden" name="id" value={videoType?.id} />
                    <Box sx={{ bgcolor: 'background.default', p: 0 }}>
                        <Box sx={{
                            mb: 2
                        }}>
                            <TextField 
                                label="Name" 
                                name="name" 
                                value={videoType?.name || ''} 
                                onChange={handleVideoTypeEditChange} 
                                required 
                                fullWidth 
                                margin="normal"
                                helperText="z.B. 1.Halbzeit, Vorbereitung" 
                            />
                            <TextField 
                                label="Sortierung" 
                                name="sort" 
                                type="number"
                                value={videoType?.sort || 0} 
                                onChange={handleVideoTypeEditChange} 
                                required 
                                fullWidth 
                                margin="normal"
                                helperText="Bestimmt die Reihenfolge (niedrigere Werte zuerst)" 
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
                        <Button onClick={onVideoTypeEditModalClose} variant="outlined" color="secondary">
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

export default VideoTypeEditModal;
