import React, { useEffect, useState } from 'react';
import {
    Button, Box, Typography, Alert, CircularProgress, Avatar, Chip, Divider, Link, Stack
} from '@mui/material';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import LinkIcon from '@mui/icons-material/Link';
import { apiJson } from '../utils/api';
import { Club } from '../types/club';
import ClubDeleteConfirmationModal from '../modals/ClubDeleteConfirmationModal';
import ClubEditModal from '../modals/ClubEditModal';
import BaseModal from './BaseModal';

interface ClubDetailsResponse {
    club: Club;
    permissions: {
        canEdit: boolean;
        canView: boolean;
        canDelete: boolean;
    };
}

interface ClubDetailsModalProps {
  open: boolean;
  clubId: number | null;
  onClose: () => void;
  loadClubs: () => void;
}

const Clubs: React.FC<ClubDetailsModalProps> = ({ open, clubId, onClose, loadClubs }) => {
    const [club, setClub] = useState<Club | null>(null);
    const [permissions, setPermissions] = useState<ClubDetailsResponse['permissions'] | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteClub, setDeleteClub] = useState<Club | null>(null);
    const [clubEditModalOpen, setClubEditModalOpen] = useState(false);

    // Initialdaten laden
    useEffect(() => {
        if (open) {
            apiJson<ClubDetailsResponse>(`/clubs/${clubId}/details`)
            .then(data => {
                setClub(data.club);
                setPermissions(data.permissions);
            })
            .catch(() => setClub(null));
        }
    }, [open]);

    return (
        <BaseModal
            open={open}
            onClose={onClose}
            maxWidth="md"
            title={
                club && permissions?.canView ? (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center"
                        }}>
                        {club.logoUrl ? (
                            <Avatar src={club.logoUrl} alt={`Logo ${club.name}`} sx={{ width: 32, height: 32, mr: 2, bgcolor: 'white', border: '1px solid #eee' }} />
                        ) : (
                            <SportsSoccerIcon sx={{ fontSize: 32, color: 'text.secondary', mr: 2 }} />
                        )}
                        <Box>
                            <Typography variant="h5" component="span">{club.name}</Typography>
                            {club.shortName && (
                                <Typography
                                    variant="body2"
                                    component="span"
                                    sx={{
                                        color: "text.secondary",
                                        ml: 1
                                    }}>
                                    ({club.shortName})
                                </Typography>
                            )}
                            {typeof club.active !== 'undefined' && (
                                <Chip
                                    label={club.active ? 'Aktiv' : 'Inaktiv'}
                                    color={club.active ? 'success' : 'default'}
                                    size="small"
                                    sx={{ ml: 1 }}
                                />
                            )}
                        </Box>
                    </Box>
                ) : undefined
            }
            actions={
                club && permissions?.canView && (permissions.canEdit || permissions.canDelete) ? (
                    <>
                        {permissions.canEdit && (
                            <Button
                                variant="contained"
                                color="warning"
                                startIcon={<EditIcon />}
                                size="small"
                                onClick={() => {
                                    setClubEditModalOpen(true);
                                }}
                                sx={{ ml: 1 }}
                                aria-label="Verein bearbeiten"
                            >
                                Bearbeiten
                            </Button>
                        )}
                        {permissions.canDelete && (
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => {
                                    setDeleteClub(club);
                                    setDeleteModalOpen(true);
                                }}
                                sx={{ ml: 1 }}
                                aria-label="Verein löschen"
                            >
                                Löschen
                            </Button>
                        )}
                    </>
                ) : undefined
            }
        >
            {club && permissions?.canView ? (
                <>
                        <Box sx={{
                            mb: 3
                        }}>
                            <Typography variant="h6" color="primary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <InfoIcon sx={{ mr: 1 }} /> Vereinsinfo
                            </Typography>
                            <Box component="dl" sx={{ m: 0 }}>
                                {club.abbreviation && (
                                    <>
                                        <Typography component="dt" variant="subtitle2" sx={{ float: 'left', width: '35%' }}>Abkürzung</Typography>
                                        <Typography component="dd" variant="body2" sx={{ ml: '35%' }}>{club.abbreviation}</Typography>
                                    </>
                                )}
                                {club.stadiumName && (
                                    <>
                                        <Typography component="dt" variant="subtitle2" sx={{ float: 'left', width: '35%' }}>Stadion</Typography>
                                        <Typography component="dd" variant="body2" sx={{ ml: '35%' }}>{club.stadiumName}</Typography>
                                    </>
                                )}
                                {club.location && (
                                    <>
                                        <Typography component="dt" variant="subtitle2" sx={{ float: 'left', width: '35%' }}>Spielstätte</Typography>
                                        <Typography component="dd" variant="body2" sx={{ ml: '35%' }}>
                                            {club.location.name}
                                            {(club.location.address || club.location.city) && (
                                                <><br /><Typography variant="caption" sx={{
                                                    color: "text.secondary"
                                                }}>
                                                    {club.location.address}{club.location.city ? `, ${club.location.city}` : ''}
                                                </Typography></>
                                            )}
                                            {club.location.capacity && (
                                                <><br /><Typography variant="caption">Zuschauer: {club.location.capacity}</Typography></>
                                            )}
                                            {club.location.surfaceType?.name && (
                                                <><br /><Typography variant="caption">Belag: {club.location.surfaceType.name}</Typography></>
                                            )}
                                            {club.location.hasFloodlight !== null && club.location.hasFloodlight !== undefined && (
                                                <><br /><Typography variant="caption">Flutlicht: {club.location.hasFloodlight ? 'Ja' : 'Nein'}</Typography></>
                                            )}
                                            {club.location.facilities && (
                                                <><br /><Typography variant="caption">Ausstattung: {club.location.facilities}</Typography></>
                                            )}
                                        </Typography>
                                    </>
                                )}
                            </Box>
                            {!club.abbreviation && !club.stadiumName && !club.location && (
                                <Alert severity="info" sx={{ mt: 2 }}>
                                    Für diesen Verein sind noch keine weiteren Informationen hinterlegt.
                                </Alert>
                            )}
                        </Box>
                        <Divider sx={{ mb: 3 }} />
                        <Box sx={{
                            mb: 3
                        }}>
                            <Typography variant="h6" color="primary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <LinkIcon sx={{ mr: 1 }} /> Kontakt & Web
                            </Typography>
                            <Box component="dl" sx={{ m: 0 }}>
                                {club.website && (
                                    <>
                                        <Typography component="dt" variant="subtitle2" sx={{ float: 'left', width: '35%' }}>
                                            Website
                                        </Typography>
                                        <Typography component="dd" variant="body2" sx={{ ml: '35%' }}>
                                            <Link href={club.website} target="_blank" rel="noopener">{club.website}</Link>
                                        </Typography>
                                    </>
                                )}
                                {club.email && (
                                    <>
                                        <Typography component="dt" variant="subtitle2" sx={{ float: 'left', width: '35%' }}>
                                            E-Mail
                                        </Typography>
                                        <Typography component="dd" variant="body2" sx={{ ml: '35%' }}>{club.email}</Typography>
                                    </>
                                )}
                                {club.phone && (
                                    <>
                                        <Typography component="dt" variant="subtitle2" sx={{ float: 'left', width: '35%' }}>
                                            Telefon
                                        </Typography>
                                        <Typography component="dd" variant="body2" sx={{ ml: '35%' }}>{club.phone}</Typography>
                                    </>
                                )}
                            </Box>
                            {!club.website && !club.email && !club.phone && (
                                <Alert severity="info" sx={{ mt: 2 }}>
                                    Es sind keine Kontaktinformationen hinterlegt.
                                </Alert>
                            )}
                        </Box>
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
            <ClubDeleteConfirmationModal
                open={deleteModalOpen}
                clubName={deleteClub?.name}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={async () => {
                    if (!deleteClub) return;
                    try {
                        await apiJson(`/clubs/${deleteClub.id}/delete`, { method: 'DELETE' });
                    } catch (e) {
                        // Fehlerbehandlung ggf. Toast
                    } finally {
                        setDeleteModalOpen(false);
                        setClub(null);
                        setDeleteClub(null);
                        onClose();
                    }
                }}
            />
            <ClubEditModal
                openClubEditModal={clubEditModalOpen}
                clubId={clubId}
                onClubEditModalClose={() => setClubEditModalOpen(false)}
                onClubSaved={() => {
                    setClubEditModalOpen(false);
                    loadClubs();
                }}
            />
        </BaseModal>
    );
};

export default Clubs;
