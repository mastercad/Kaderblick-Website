import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, Button, Box, TextField, CircularProgress, Alert, Divider, IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { GameEventType } from '../types/gameEventType';
import { apiJson } from '../utils/api';

interface GameEventTypeEditModalProps {
    openGameEventTypeEditModal: boolean;
    gameEventTypeId: number | null;
    onGameEventTypeEditModalClose: () => void;
    onGameEventTypeSaved?: (gameEventType: GameEventType) => void;
}

const GameEventTypeEditModal: React.FC<GameEventTypeEditModalProps> = ({ openGameEventTypeEditModal, gameEventTypeId, onGameEventTypeEditModalClose, onGameEventTypeSaved }) => {
    const [gameEventType, setGameEventType] = useState<GameEventType | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (openGameEventTypeEditModal && gameEventTypeId) {
            setLoading(true);
            apiJson<{ gameEventType: GameEventType }>(`/api/game-event-types/${gameEventTypeId}`)
                .then(data => {
                    setGameEventType(data.gameEventType);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Spielereignistypdaten.');
                    setLoading(false);
                });
        } else if (openGameEventTypeEditModal) {
            setGameEventType(null);
        }
    }, [openGameEventTypeEditModal, gameEventTypeId]);

    const handleGameEventTypeEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setGameEventType((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleGameEventTypeEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const url = gameEventType!.id ? `/api/game-event-types/${gameEventType!.id}` : '/api/game-event-types';
          const method = gameEventType!.id ? 'PUT' : 'POST';
          const res = await apiJson(url, {
            method,
            body: gameEventType,
            headers: { 'Content-Type': 'application/json' },
          });

          if (onGameEventTypeSaved) onGameEventTypeSaved(res.gameEventType || res.data || gameEventType);
          onGameEventTypeEditModalClose();
        } catch (err: any) {
          setError(err?.message || 'Fehler beim Speichern');
        } finally {
          setLoading(false);
        }
    };

    return (
        <Dialog open={openGameEventTypeEditModal} onClose={onGameEventTypeEditModalClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
                Spielereignistyp bearbeiten
                <IconButton aria-label="close" onClick={onGameEventTypeEditModalClose} size="small" sx={{ ml: 2 }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
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
                    <form id="gameEventTypeEditForm" autoComplete="off" onSubmit={handleGameEventTypeEditSubmit}>
                        <input type="hidden" name="id" value={gameEventType?.id} />
                        <Box sx={{ bgcolor: 'background.default', p: 0 }}>
                            <Box sx={{
                                mb: 2
                            }}>
                                <TextField label="Name" name="name" value={gameEventType?.name || ''} onChange={handleGameEventTypeEditChange} required fullWidth margin="normal" />
                                <TextField label="Code" name="code" value={gameEventType?.code || ''} onChange={handleGameEventTypeEditChange} fullWidth margin="normal" />
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 2,
                                        mt: 1,
                                        mb: 1
                                    }}>
                                    <TextField label="Farbe" name="color" value={gameEventType?.color || ''} onChange={handleGameEventTypeEditChange} fullWidth margin="normal" type="color"
                                        sx={{ width: 120 }}
                                        slotProps={{
                                            inputLabel: { shrink: true }
                                        }}
                                    />
                                    <Box sx={{ ml: 1 }}>
                                        <span style={{ display: 'inline-block', width: 32, height: 32, borderRadius: 4, background: gameEventType?.color || '#eee', border: '1px solid #ccc' }} />
                                    </Box>
                                </Box>
                                <TextField label="Icon (FontAwesome)" name="icon" value={gameEventType?.icon || ''} onChange={handleGameEventTypeEditChange} fullWidth margin="normal" placeholder="z.B. fas fa-futbol" />
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        mt: 1
                                    }}>
                                    <label style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                        <span style={{ flex: 1 }}>Systemtyp</span>
                                        <input
                                            type="checkbox"
                                            name="isSystem"
                                            checked={!!gameEventType?.isSystem}
                                            onChange={e => setGameEventType((prev: any) => ({ ...prev, isSystem: e.target.checked }))}
                                            style={{ marginLeft: 8 }}
                                        />
                                    </label>
                                </Box>
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
                            <Button onClick={onGameEventTypeEditModalClose} variant="outlined" color="secondary">
                                Abbrechen
                            </Button>
                            <Button type="submit" variant="contained" color="primary" disabled={saving}>
                                {saving ? <CircularProgress size={20} /> : 'Speichern'}
                            </Button>
                        </Box>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default GameEventTypeEditModal;
