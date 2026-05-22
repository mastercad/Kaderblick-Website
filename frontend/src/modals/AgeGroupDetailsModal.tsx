import React, { useEffect, useState } from 'react';
import {
    Button, Box, Typography, CircularProgress, Divider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { apiJson } from '../utils/api';
import { AgeGroup } from '../types/ageGroup';
import AgeGroupDeleteConfirmationModal from './AgeGroupDeleteConfirmationModal';
import AgeGroupEditModal from './AgeGroupEditModal';
import BaseModal from './BaseModal';

interface AgeGroupDetailsModalProps {
  ageGroupDetailOpen: boolean;
  ageGroupId: number | null;
  onClose: () => void;
  loadAgeGroups: () => void;
}

const AgeGroupDetailsModal: React.FC<AgeGroupDetailsModalProps> = ({ ageGroupDetailOpen, ageGroupId, onClose, loadAgeGroups }) => {
    const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteAgeGroup, setDeleteAgeGroup] = useState<AgeGroup | null>(null);
    const [ageGroupEditModalOpen, setAgeGroupEditModalOpen] = useState(false);

    // Initialdaten laden
    useEffect(() => {
        if (ageGroupDetailOpen) {
            apiJson<{ ageGroup: AgeGroup }>(`/api/age-groups/${ageGroupId}`)
            .then(data => {
                setAgeGroup(data.ageGroup);
            })
            .catch(() => setAgeGroup(null));
        }
    }, [ageGroupDetailOpen]);

    const title = ageGroup ? (
        <Box>
            <Typography variant="h6" component="span">{ageGroup.name}</Typography>
            <Typography variant="body2" component="span" sx={{ ml: 2, color: 'text.secondary' }}>
                ({ageGroup.englishName})
            </Typography>
        </Box>
    ) : 'Altersgruppe';

    return (
        <>
            <BaseModal
                open={ageGroupDetailOpen}
                onClose={onClose}
                title={title}
                maxWidth="sm"
                actions={
                    ageGroup && ageGroup.permissions?.canView ? (
                        <>
                            {ageGroup.permissions?.canEdit && (
                                <Button 
                                    variant="contained" 
                                    color="warning" 
                                    startIcon={<EditIcon />}
                                    onClick={() => {
                                        setAgeGroupEditModalOpen(true);
                                    }}
                                    aria-label="Altersgruppe bearbeiten"
                                >
                                    Bearbeiten
                                </Button>
                            )}
                            {ageGroup.permissions.canDelete && (
                                <Button 
                                    variant="contained" 
                                    color="error" 
                                    startIcon={<DeleteIcon />}
                                    onClick={() => {
                                        setDeleteAgeGroup(ageGroup);
                                        setDeleteModalOpen(true);
                                    }}
                                    aria-label="Altersgruppe löschen"
                                >
                                    Löschen
                                </Button>
                            )}
                        </>
                    ) : undefined
                }
            >
                {ageGroup && ageGroup.permissions?.canView ? (
                    <Box>
                        <Typography
                            variant="body2"
                            sx={{
                                color: "text.secondary",
                                mb: 0.5
                            }}>Beschreibung</Typography>
                        <Typography variant="body1" sx={{ mb: 2 }}>{ageGroup.description}</Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 2
                            }}>
                            <Box>
                                <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>Code</Typography>
                                <Typography variant="body1">{ageGroup.code}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>Stichtag</Typography>
                                <Typography variant="body1">{ageGroup.referenceDate}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>Mindestalter</Typography>
                                <Typography variant="body1">{ageGroup.minAge} Jahre</Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{
                                    color: "text.secondary"
                                }}>Höchstalter</Typography>
                                <Typography variant="body1">{ageGroup.maxAge} Jahre</Typography>
                            </Box>
                        </Box>
                    </Box>
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
            <AgeGroupDeleteConfirmationModal
                open={deleteModalOpen}
                ageGroupName={deleteAgeGroup?.name}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={async () => {
                    if (!deleteAgeGroup) return;
                    try {
                        await apiJson(`/api/age-groups/${deleteAgeGroup.id}`, { method: 'DELETE' });
                    } catch (e) {
                        // Fehlerbehandlung ggf. Toast
                    } finally {
                        setDeleteModalOpen(false);
                        setAgeGroup(null);
                        setDeleteAgeGroup(null);
                        loadAgeGroups();
                        onClose();
                    }
                }}
            />
            <AgeGroupEditModal
                openAgeGroupEditModal={ageGroupEditModalOpen}
                ageGroupId={ageGroupId}
                onAgeGroupEditModalClose={() => setAgeGroupEditModalOpen(false)}
                onAgeGroupSaved={() => {
                    setAgeGroupEditModalOpen(false);
                    loadAgeGroups();
                }}
            />
        </>
    );
};

export default AgeGroupDetailsModal;
