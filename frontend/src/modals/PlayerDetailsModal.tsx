import React, { useEffect, useState } from 'react';
import {
    Button, Box, Typography, CircularProgress, Avatar, Chip, Stack, Tooltip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { apiJson } from '../utils/api';
import { Player } from '../types/player';
import PlayerDeleteConfirmationModal from './PlayerDeleteConfirmationModal';
import PlayerEditModal from './PlayerEditModal';
import BaseModal from './BaseModal';
import { SharePosterButton } from '../pages/PosterGenerator/components/SharePosterButton';

interface PlayerDetailsResponse {
    player: Player;
    permissions: {
        canEdit: boolean;
        canView: boolean;
        canDelete: boolean;
    };
}

interface PlayerDetailsModalProps {
  open: boolean;
  playerId: number | null;
  onClose: () => void;
  loadPlayeres: () => void;
}


const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({ open, playerId, onClose, loadPlayeres }) => {
    const [player, setPlayer] = useState<Player | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletePlayer, setDeletePlayer] = useState<Player | null>(null);
    const [playerEditModalOpen, setPlayerEditModalOpen] = useState(false);

    useEffect(() => {
        if (open) {
            apiJson<PlayerDetailsResponse>(`/api/players/${playerId}`)
                .then(data => {
                    setPlayer(data.player);
                })
                .catch(() => setPlayer(null));
        }
    }, [open, playerId]);

    // Hilfsfunktionen für die Anzeige
    const getTeams = () => player?.teamAssignments?.map(a => a.team) || [];
    const getLicenses = () => player?.licenseAssignments?.map(a => a.license) || [];
    const getNationalities = () => player?.nationalityAssignments?.map(a => a.nationality) || [];

    return (
        <>
            <BaseModal
                open={open}
                onClose={onClose}
                maxWidth="sm"
                title={
                    player && player.permissions?.canView ? (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center"
                            }}>
                            {player.profilePicturePath ? (
                                <Avatar src={player.profilePicturePath} alt={`${player.firstName} ${player.lastName}`} sx={{ width: 48, height: 48, mr: 2, bgcolor: 'white', border: '1px solid #eee' }} />
                            ) : (
                                <Avatar sx={{ width: 48, height: 48, mr: 2, bgcolor: 'grey.100', color: 'text.secondary' }}>
                                    <SportsSoccerIcon />
                                </Avatar>
                            )}
                            <Box>
                                <Typography variant="h6">{player.firstName} {player.lastName}</Typography>
                                <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>{player.email}</Typography>
                                <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>Geburtsdatum: {player.birthDate}</Typography>
                            </Box>
                        </Box>
                    ) : ''
                }
                actions={
                    player?.permissions?.canView ? (
                        <>
                            <SharePosterButton
                              payload={{ templateId: 'player-highlight', data: { player } }}
                              label="Highlight teilen"
                              size="small"
                              stopPropagation={false}
                            />
                            {player.permissions?.canEdit && (
                                <Button variant="contained" color="warning" startIcon={<EditIcon />} size="small" onClick={() => setPlayerEditModalOpen(true)}>
                                    Bearbeiten
                                </Button>
                            )}
                            {player.permissions?.canDelete && (
                                <Button variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => { setDeletePlayer(player); setDeleteModalOpen(true); }}>
                                    Löschen
                                </Button>
                            )}
                        </>
                    ) : null
                }
            >
                {player && player.permissions?.canView ? (
                    <Stack spacing={3}>
                        {/* Teams */}
                        <Box>
                            <Typography variant="subtitle1" gutterBottom sx={{
                                fontWeight: 600
                            }}>Teams</Typography>
                            <Stack direction="row" spacing={1} sx={{
                                flexWrap: "wrap"
                            }}>
                                {getTeams().length > 0 ? getTeams().map(team => (
                                    <Tooltip key={team.id} title={`Altersklasse: ${team.ageGroup?.name}, Liga: ${team.league?.name}`} arrow>
                                        <Chip label={team.name} color="primary" variant="outlined" sx={{ mb: 1 }} />
                                    </Tooltip>
                                )) : <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>Keine Teams zugewiesen</Typography>}
                            </Stack>
                        </Box>
                        {/* Lizenzen */}
                        <Box>
                            <Typography variant="subtitle1" gutterBottom sx={{
                                fontWeight: 600
                            }}>Lizenzen</Typography>
                            <Stack direction="row" spacing={1} sx={{
                                flexWrap: "wrap"
                            }}>
                                {getLicenses().length > 0 ? getLicenses().map((license: any, idx: number) => (
                                    <Chip key={(license?.name || idx) + idx} label={license?.name} color="success" variant="outlined" sx={{ mb: 1 }} />
                                )) : <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>Keine Lizenzen</Typography>}
                            </Stack>
                        </Box>
                        {/* Nationalitäten */}
                        <Box>
                            <Typography variant="subtitle1" gutterBottom sx={{
                                fontWeight: 600
                            }}>Nationalitäten</Typography>
                            <Stack direction="row" spacing={1} sx={{
                                flexWrap: "wrap"
                            }}>
                                {getNationalities().length > 0 ? getNationalities().map((nat, idx) => (
                                    <Chip key={nat.id + idx} label={nat.name} color="info" variant="outlined" sx={{ mb: 1 }} />
                                )) : <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>Keine Nationalitäten</Typography>}
                            </Stack>
                        </Box>
                    </Stack>
                ) : (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 200
                        }}>
                        <CircularProgress />
                    </Box>
                )}
            </BaseModal>
            <PlayerDeleteConfirmationModal
                open={deleteModalOpen}
                playerName={deletePlayer?.firstName + ' ' + deletePlayer?.lastName}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={async () => {
                    if (!deletePlayer) return;
                    try {
                        await apiJson(`/players/${deletePlayer.id}/delete`, { method: 'DELETE' });
                    } catch (e) {
                        // Fehlerbehandlung ggf. Toast
                    } finally {
                        setDeleteModalOpen(false);
                        setPlayer(null);
                        setDeletePlayer(null);
                        onClose();
                    }
                }}
            />
            <PlayerEditModal
                openPlayerEditModal={playerEditModalOpen}
                playerId={playerId}
                onPlayerEditModalClose={() => setPlayerEditModalOpen(false)}
                onPlayerSaved={() => {
                    setPlayerEditModalOpen(false);
                    loadPlayeres();
                }}
            />
        </>
    );
};

export default PlayerDetailsModal;
