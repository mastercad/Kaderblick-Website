import React, { useEffect, useState } from 'react';
import {
    Button, Box, Typography, CircularProgress, Avatar, Chip, Divider, Stack, Tooltip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { apiJson } from '../utils/api';
import { Coach } from '../types/coach';
import CoachDeleteConfirmationModal from './CoachDeleteConfirmationModal';
import CoachEditModal from './CoachEditModal';
import BaseModal from './BaseModal';

interface CoachDetailsResponse {
    coach: Coach;
    permissions: {
        canEdit: boolean;
        canView: boolean;
        canDelete: boolean;
    };
}

interface CoachDetailsModalProps {
  open: boolean;
  coachId: number | null;
  onClose: () => void;
  loadCoaches: () => void;
}


const CoachDetailsModal: React.FC<CoachDetailsModalProps> = ({ open, coachId, onClose, loadCoaches }) => {
    const [coach, setCoach] = useState<Coach | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteCoach, setDeleteCoach] = useState<Coach | null>(null);
    const [coachEditModalOpen, setCoachEditModalOpen] = useState(false);

    useEffect(() => {
        if (open) {
            apiJson<CoachDetailsResponse>(`/api/coaches/${coachId}`)
                .then(data => {
                    setCoach(data.coach);
                })
                .catch(() => setCoach(null));
        }
    }, [open, coachId]);

    // Hilfsfunktionen für die Anzeige
    const getTeams = () => coach?.teamAssignments?.map(a => a.team) || [];
    const getLicenses = () => coach?.licenseAssignments?.map(a => a.license) || [];
    const getNationalities = () => coach?.nationalityAssignments?.map(a => a.nationality) || [];

    return (
        <>
            <BaseModal
                open={open}
                onClose={onClose}
                maxWidth="sm"
                title={
                    coach && coach.permissions?.canView ? (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center"
                            }}>
                            {coach.profilePicturePath ? (
                                <Avatar src={coach.profilePicturePath} alt={`${coach.firstName} ${coach.lastName}`} sx={{ width: 48, height: 48, mr: 2, bgcolor: 'white', border: '1px solid #eee' }} />
                            ) : (
                                <Avatar sx={{ width: 48, height: 48, mr: 2, bgcolor: 'grey.100', color: 'text.secondary' }}>
                                    <SportsSoccerIcon />
                                </Avatar>
                            )}
                            <Box>
                                <Typography variant="h5">{coach.firstName} {coach.lastName}</Typography>
                                <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>{coach.email}</Typography>
                                <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>Geburtsdatum: {coach.birthDate}</Typography>
                            </Box>
                        </Box>
                    ) : undefined
                }
                actions={
                    coach && coach.permissions?.canView && (coach.permissions.canEdit || coach.permissions.canDelete) ? (
                        <>
                            {coach.permissions.canEdit && (
                                <Button variant="contained" color="warning" startIcon={<EditIcon />} size="small" onClick={() => setCoachEditModalOpen(true)} sx={{ ml: 1 }}>
                                    Bearbeiten
                                </Button>
                            )}
                            {coach.permissions.canDelete && (
                                <Button variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => { setDeleteCoach(coach); setDeleteModalOpen(true); }} sx={{ ml: 1 }}>
                                    Löschen
                                </Button>
                            )}
                        </>
                    ) : undefined
                }
            >
                {coach && coach.permissions?.canView ? (
                    <>
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
                                    {getLicenses().length > 0 ? getLicenses().map((license, idx) => (
                                        <Chip key={license.name + idx} label={license.name} color="success" variant="outlined" sx={{ mb: 1 }} />
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
                    </>
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
            <CoachDeleteConfirmationModal
                open={deleteModalOpen}
                coachName={deleteCoach?.firstName + ' ' + deleteCoach?.lastName}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={async () => {
                    if (!deleteCoach) return;
                    try {
                        await apiJson(`/coaches/${deleteCoach.id}/delete`, { method: 'DELETE' });
                    } catch (e) {
                        // Fehlerbehandlung ggf. Toast
                    } finally {
                        setDeleteModalOpen(false);
                        setCoach(null);
                        setDeleteCoach(null);
                        onClose();
                    }
                }}
            />
            <CoachEditModal
                openCoachEditModal={coachEditModalOpen}
                coachId={coachId}
                onCoachEditModalClose={() => setCoachEditModalOpen(false)}
                onCoachSaved={() => {
                    setCoachEditModalOpen(false);
                    loadCoaches();
                }}
            />
        </>
    );
};

export default CoachDetailsModal;
