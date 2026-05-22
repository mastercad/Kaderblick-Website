import React, { useEffect, useState } from 'react';
import {
    Button, Box, Typography, TextField, InputAdornment, CircularProgress, Alert, Divider, IconButton, Chip, Stack
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CoachLicenseEditModal from './CoachLicenseEditModal';
import NationalityEditModal from './NationalityEditModal';
import ClubEditModal from './ClubEditModal';
import { CoachLicense } from '../types/coachLicense';
import { Nationality } from '../types/nationality';
import { Coach } from '../types/coach';
import { Club } from '../types/club';
import { Team } from '../types/team';
import { apiJson } from '../utils/api';
import { toDateInputValue } from '../utils/date';
import { CoachTeamAssignmentType } from '../types/coachTeamAssignmentType';
import BaseModal from './BaseModal';

interface CoachEditModalProps {
    openCoachEditModal: boolean;
    coachId: number | null;
    onCoachEditModalClose: () => void;
    onCoachSaved?: (coach: Coach) => void;
}

const CoachEditModal: React.FC<CoachEditModalProps> = ({ openCoachEditModal, coachId, onCoachEditModalClose, onCoachSaved }) => 
{
    // State für die Modals zum Anlegen
    const [openLicenseModal, setOpenLicenseModal] = useState(false);
    const [openClubModal, setOpenClubModal] = useState(false);
    const [openNationalityModal, setOpenNationalityModal] = useState(false);
    // ID merken, für das Assignment das gerade editiert wird
    const [licenseModalId, setLicenseModalId] = useState<number | null>(null);
    const [clubModalId, setClubModalId] = useState<number | null>(null);
    const [nationalityModalId, setNationalityModalId] = useState<number | null>(null);
    const [coach, setCoach] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Multi-Select States
    const [allClubs, setAllClubs] = useState<Club[]>([]);
    const [allCoachTeamAssignmentTypes, setAllCoachTeamAssignmentTypes] = useState<CoachTeamAssignmentType[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [allLicenses, setAllLicenses] = useState<CoachLicense[]>([]);
    const [allNationalities, setAllNationalities] = useState<Nationality[]>([]);

    useEffect(() => {
        if (openCoachEditModal) {
            setError(null);
            apiJson('/api/clubs').then(res => setAllClubs(res.entries || [])).catch(() => setAllClubs([]));
            apiJson('/api/teams').then(res => setAllTeams(res.teams || [])).catch(() => setAllTeams([]));
            apiJson('/api/coach-team-assignment-types').then(res => setAllCoachTeamAssignmentTypes(res.coachTeamAssignmentTypes || [])).catch(() => setAllCoachTeamAssignmentTypes([]));
            apiJson('/api/coach-licenses').then(res => setAllLicenses(res.coachLicenses || [])).catch(() => setAllLicenses([]));
            apiJson('/api/nationalities').then(res => setAllNationalities(res.nationalities || [])).catch(() => setAllNationalities([]));
        }
    }, [openCoachEditModal]);

    useEffect(() => {
        if (openCoachEditModal && coachId) {
            setLoading(true);
            apiJson(`/api/coaches/${coachId}`)
                .then(data => {
                    // Mappe teamAssignments: type => type.id
                    const coach = data.coach;
                    if (coach && Array.isArray(coach.teamAssignments)) {
                        coach.teamAssignments = coach.teamAssignments.map((a: any) => ({
                            ...a,
                            type: a.type && typeof a.type === 'object' ? String(a.type.id)
                                : a.type !== undefined && a.type !== null ? String(a.type)
                                : a.team && a.team.type && a.team.type.id ? String(a.team.type.id)
                                : '',
                            startDate: toDateInputValue(a.startDate),
                            endDate: toDateInputValue(a.endDate),
                        }));
                    }
                    setCoach(coach);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Trainerdaten.');
                    setLoading(false);
                });
        } else if (openCoachEditModal) {
            setCoach(null);
        }
    }, [openCoachEditModal, coachId]);

    const handleCoachEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setCoach((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleClubAssignmentChange = (id: number, field: string, value: any) => {
        setCoach((prev: any) => {
            const assignments = (prev.clubAssignments || []).map((a: any) =>
                a.id === id ? { ...a, [field]: value } : a
            );
            return { ...prev, clubAssignments: assignments };
        });
    };

    const handleTeamAssignmentChange = (id: number, field: string, value: any) => {
        setCoach((prev: any) => {
            const assignments = (prev.teamAssignments || []).map((a: any) =>
                a.id === id ? { ...a, [field]: value } : a
            );
            return { ...prev, teamAssignments: assignments };
        });
    };
    const handleAddTeamAssignment = () => {
        setCoach((prev: any) => {
            const base = prev ?? {};
            return {
                ...base,
                teamAssignments: [
                    ...(base.teamAssignments || []),
                    { id: null, team: null, type: '', startDate: undefined, endDate: undefined }
                ]
            };
        });
    };
    const handleRemoveTeamAssignment = (id: number) => {
        setCoach((prev: any) => {
            const assignments = (prev.teamAssignments || []).filter((a: any) => a.id !== id);
            return { ...prev, teamAssignments: assignments };
        });
    };
    const handleRemoveClubAssignment = (id: number) => {
        setCoach((prev: any) => {
            const assignments = (prev.clubAssignments || []).filter((a: any) => a.id !== id);
            return { ...prev, clubAssignments: assignments };
        });
    };
    const handleLicenseAssignmentChange = (id: number, field: string, value: any) => {
        setCoach((prev: any) => {
            const assignments = (prev.licenseAssignments || []).map((a: any) =>
                a.id === id ? { ...a, [field]: value } : a
            );
            return { ...prev, licenseAssignments: assignments };
        });
    };
    const handleAddLicenseAssignment = () => {
        setCoach((prev: any) => {
            const base = prev ?? {};
            return {
                ...base,
                licenseAssignments: [
                    ...(base.licenseAssignments || []),
                    { id: null, license: null, startDate: undefined, endDate: undefined }
                ]
            };
        });
    };
    const handleAddClubAssignment = () => {
        setCoach((prev: any) => {
            const base = prev ?? {};
            return {
                ...base,
                clubAssignments: [
                    ...(base.clubAssignments || []),
                    { id: null, club: null, startDate: undefined, endDate: undefined }
                ]
            };
        });
    };
    const handleRemoveLicenseAssignment = (id: number) => {
        setCoach((prev: any) => {
            const assignments = (prev.licenseAssignments || []).filter((a: any) => a.id !== id);
            return { ...prev, licenseAssignments: assignments };
        });
    };

    const handleNationalityAssignmentChange = (id: number, field: string, value: any) => {
        setCoach((prev: any) => {
            const assignments = (prev.nationalityAssignments || []).map((a: any) =>
                a.id === id ? { ...a, [field]: value } : a
            );
            return { ...prev, nationalityAssignments: assignments };
        });
    };
    const handleAddNationalityAssignment = () => {
        setCoach((prev: any) => {
            const base = prev ?? {};
            return {
                ...base,
                nationalityAssignments: [
                    ...(base.nationalityAssignments || []),
                    { id: null, nationality: null, startDate: undefined, endDate: undefined }
                ]
            };
        });
    };
    const handleRemoveNationalityAssignment = (id: number) => {
        setCoach((prev: any) => {
            const assignments = (prev.nationalityAssignments || []).filter((a: any) => a.id !== id);
            return { ...prev, nationalityAssignments: assignments };
        });
    };

    const handleCoachEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const url = coach.id ? `/api/coaches/${coach.id}` : '/api/coaches';
          const method = coach.id ? 'PUT' : 'POST';
          const res = await apiJson(url, {
            method,
            body: coach,
            headers: { 'Content-Type': 'application/json' },
          });

          if (onCoachSaved) onCoachSaved(res.coach || res.data || coach);
          onCoachEditModalClose();
        } catch (err: any) {
          setError(err?.message || 'Fehler beim Speichern');
        } finally {
          setLoading(false);
        }
    };

    return (
        <>
            <BaseModal
                open={openCoachEditModal}
                onClose={onCoachEditModalClose}
                maxWidth="md"
                title="Trainer bearbeiten"
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
                ) : (
                <>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2, fontWeight: 'bold', fontSize: '1.1em' }}>
                            {error}
                        </Alert>
                    )}
                    <form id="coachEditForm" autoComplete="off" onSubmit={handleCoachEditSubmit}>
                        <input type="hidden" name="id" value={coach?.id} />
                        <Box className="modal-body" sx={{ bgcolor: 'background.default', p: 0 }}>
                            {/* Stammdaten zuerst */}
                            <Box
                                sx={{
                                    mb: 4,
                                    pb: 2,
                                    borderBottom: 1,
                                    borderColor: "divider"
                                }}>
                                <Typography
                                    variant="h6"
                                    color="primary"
                                    sx={{
                                        mb: 3,
                                        display: "flex",
                                        alignItems: "center"
                                    }}>
                                    Stammdaten
                                </Typography>
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 2
                                    }}>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Vorname" name="firstName" value={coach?.firstName || ''} onChange={handleCoachEditChange} required fullWidth margin="normal" />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Nachname" name="lastName" value={coach?.lastName || ''} onChange={handleCoachEditChange} required fullWidth margin="normal" />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="E-Mail" name="email" value={coach?.email || ''} onChange={handleCoachEditChange} fullWidth margin="normal" slotProps={{
                                            input: { startAdornment: <InputAdornment position="start">✉️</InputAdornment> }
                                        }} />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Geburtsdatum" name="birthDate" type="date" value={coach?.birthDate || ''} onChange={handleCoachEditChange} fullWidth margin="normal" slotProps={{
                                            inputLabel: { shrink: true }
                                        }} />
                                    </Box>
                                </Box>
                            </Box>
                            <Box
                                sx={{
                                    mb: 4,
                                    pb: 2,
                                    borderBottom: 1,
                                    borderColor: "divider"
                                }}>
                                <Typography
                                    variant="h6"
                                    color="primary"
                                    sx={{
                                        mb: 3,
                                        display: "flex",
                                        alignItems: "center"
                                    }}>
                                    Zugehörigkeiten
                                </Typography>
                                <Stack spacing={2}>
                                    <Box>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                mt: 2,
                                                mb: 1
                                            }}>Verein-Zuordnungen</Typography>
                                        {(coach?.clubAssignments ?? []).map((assignment: any) => (
                                        <Box
                                            key={assignment.id}
                                            sx={{
                                                display: "flex",
                                                gap: 2,
                                                alignItems: "center",
                                                mb: 1
                                            }}>
                                            <Autocomplete
                                                options={[...allClubs, { id: 'new', name: 'Neuen Verein anlegen...' }]}
                                                getOptionLabel={(option) => option.name}
                                                value={assignment.club || null}
                                                onChange={(_, newValue) => {
                                                    if (newValue && (newValue as any).id === 'new') {
                                                        setClubModalId(assignment.id);
                                                        setOpenClubModal(true);
                                                    } else {
                                                        handleClubAssignmentChange(assignment.id, 'club', newValue);
                                                    }
                                                }}
                                                renderOption={(props, option) => {
                                                    if ((option as any).id === 'new') {
                                                        const { key, ...rest } = props;
                                                        return (
                                                            <li key={key} {...rest} style={{ display: 'flex', alignItems: 'center', color: '#1976d2', fontWeight: 500 }}>
                                                                <AddIcon fontSize="small" style={{ marginRight: 8 }} /> Neuen Verein anlegen...
                                                            </li>
                                                        );
                                                    }
                                                    const { key, ...rest } = props;
                                                    return (
                                                        <li key={key} {...rest}>{option.name}</li>
                                                    );
                                                }}
                                                renderInput={(params) => (
                                                    <TextField {...params} label="Verein" fullWidth margin="normal" required />
                                                )}
                                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                                sx={{ minWidth: 180 }}
                                            />
                                            <TextField
                                                label="Start"
                                                type="date"
                                                value={assignment.startDate || ''}
                                                onChange={e => handleClubAssignmentChange(assignment.id, 'startDate', e.target.value)}
                                                sx={{ minWidth: 120 }}
                                                required
                                                slotProps={{
                                                    inputLabel: { shrink: true }
                                                }}
                                            />
                                            <TextField
                                                label="Ende"
                                                type="date"
                                                value={assignment.endDate || ''}
                                                onChange={e => handleClubAssignmentChange(assignment.id, 'endDate', e.target.value)}
                                                sx={{ minWidth: 120 }}
                                                slotProps={{
                                                    inputLabel: { shrink: true }
                                                }}
                                            />
                                            <IconButton onClick={() => handleRemoveClubAssignment(assignment.id)} color="error" size="small"><DeleteIcon /></IconButton>
                                        </Box>
                                        ))}
                                        <Button onClick={handleAddClubAssignment} startIcon={<AddIcon />} size="small" sx={{ mt: 1 }}>Verein-Zuordnung hinzufügen</Button>
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                mt: 2,
                                                mb: 1
                                            }}>Team-Zuordnungen</Typography>
                                        {(coach?.teamAssignments ?? []).map((assignment: any) => (
                                        <Box
                                            key={assignment.id}
                                            sx={{
                                                display: "flex",
                                                gap: 2,
                                                alignItems: "center",
                                                mb: 1
                                            }}><Autocomplete
                                                options={allTeams}
                                                getOptionLabel={(option) => option.name}
                                                value={assignment.team || null}
                                                onChange={(_, newValue) => handleTeamAssignmentChange(assignment.id, 'team', newValue)}
                                                renderInput={(params) => (
                                                    <TextField {...params} label="Team" fullWidth margin="normal" required />
                                                )}
                                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                                sx={{ minWidth: 180 }}
                                            />
                                            <TextField
                                                select
                                                label="Typ"
                                                value={assignment.type ? String(assignment.type) : ''}
                                                onChange={e => handleTeamAssignmentChange(assignment.id, 'type', e.target.value)}
                                                sx={{ minWidth: 140 }}
                                                slotProps={{
                                                    select: { native: true }
                                                }}
                                            >
                                                <option value="">Typ wählen...</option>
                                                {allCoachTeamAssignmentTypes.map(assignmentType => (
                                                    <option key={assignmentType.id} value={String(assignmentType.id)}>{assignmentType.name}</option>
                                                ))}
                                            </TextField>
                                            <TextField
                                                label="Start"
                                                type="date"
                                                value={assignment.startDate || ''}
                                                onChange={e => handleTeamAssignmentChange(assignment.id, 'startDate', e.target.value)}
                                                sx={{ minWidth: 120 }}
                                                required
                                                slotProps={{
                                                    inputLabel: { shrink: true }
                                                }}
                                            />
                                            <TextField
                                                label="Ende"
                                                type="date"
                                                value={assignment.endDate || ''}
                                                onChange={e => handleTeamAssignmentChange(assignment.id, 'endDate', e.target.value)}
                                                sx={{ minWidth: 120 }}
                                                slotProps={{
                                                    inputLabel: { shrink: true }
                                                }}
                                            />
                                            <IconButton onClick={() => handleRemoveTeamAssignment(assignment.id)} color="error" size="small"><DeleteIcon /></IconButton>
                                        </Box>
                                        ))}
                                        <Button onClick={handleAddTeamAssignment} startIcon={<AddIcon />} size="small" sx={{ mt: 1 }}>Team-Zuordnung hinzufügen</Button>
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                mt: 2,
                                                mb: 1
                                            }}>Lizenzen</Typography>
                                        {(coach?.licenseAssignments ?? []).map((assignment: any) => (
                                        <Box
                                            key={assignment.id}
                                            sx={{
                                                display: "flex",
                                                gap: 2,
                                                alignItems: "center",
                                                mb: 1
                                            }}>
                                            <Autocomplete
                                                options={[...allLicenses, { id: 'new', name: 'Neue Lizenz anlegen...' }]}
                                                getOptionLabel={(option) => option.name}
                                                value={assignment.license || null}
                                                onChange={(_, newValue) => {
                                                    if (newValue && (newValue as any).id === 'new') {
                                                        setLicenseModalId(assignment.id);
                                                        setOpenLicenseModal(true);
                                                    } else {
                                                        handleLicenseAssignmentChange(assignment.id, 'license', newValue);
                                                    }
                                                }}
                                                renderOption={(props, option) => {
                                                    if ((option as any).id === 'new') {
                                                        const { key, ...rest } = props;
                                                        return (
                                                            <li key={key} {...rest} style={{ display: 'flex', alignItems: 'center', color: '#1976d2', fontWeight: 500 }}>
                                                                <AddIcon fontSize="small" style={{ marginRight: 8 }} /> Neue Lizenz anlegen...
                                                            </li>
                                                        );
                                                    }
                                                    const { key, ...rest } = props;
                                                    return (
                                                        <li key={key} {...rest}>{option.name}</li>
                                                    );
                                                }}
                                                renderInput={(params) => (
                                                    <TextField {...params} label="Lizenz" fullWidth margin="normal" required />
                                                )}
                                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                                sx={{ minWidth: 180 }}
                                            />
                                            <TextField
                                                label="Start"
                                                type="date"
                                                value={assignment.startDate || ''}
                                                onChange={e => handleLicenseAssignmentChange(assignment.id, 'startDate', e.target.value)}
                                                sx={{ minWidth: 120 }}
                                                required
                                                slotProps={{
                                                    inputLabel: { shrink: true }
                                                }}
                                            />
                                            <TextField
                                                label="Ende"
                                                type="date"
                                                value={assignment.endDate || ''}
                                                onChange={e => handleLicenseAssignmentChange(assignment.id, 'endDate', e.target.value)}
                                                sx={{ minWidth: 120 }}
                                                slotProps={{
                                                    inputLabel: { shrink: true }
                                                }}
                                            />
                                            <IconButton onClick={() => handleRemoveLicenseAssignment(assignment.id)} color="error" size="small"><DeleteIcon /></IconButton>
                                        </Box>
                                        ))}
                                        <Button onClick={handleAddLicenseAssignment} startIcon={<AddIcon />} size="small" sx={{ mt: 1 }}>Lizenz hinzufügen</Button>
                                    </Box>
                                    <Box>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                mt: 2,
                                                mb: 1
                                            }}>Nationalitäten</Typography>
                                        {(coach?.nationalityAssignments ?? []).map((assignment: any) => (
                                        <Box
                                            key={assignment.id}
                                            sx={{
                                                display: "flex",
                                                gap: 2,
                                                alignItems: "center",
                                                mb: 1
                                            }}>
                                            <Autocomplete
                                                options={[...allNationalities, { id: 'new', name: 'Neue Nationalität anlegen...' }]}
                                                getOptionLabel={(option) => option.name}
                                                value={assignment.nationality || null}
                                                onChange={(_, newValue) => {
                                                    if (newValue && (newValue as any).id === 'new') {
                                                        setNationalityModalId(assignment.id);
                                                        setOpenNationalityModal(true);
                                                    } else {
                                                        handleNationalityAssignmentChange(assignment.id, 'nationality', newValue);
                                                    }
                                                }}
                                                renderOption={(props, option) => {
                                                    if ((option as any).id === 'new') {
                                                        const { key, ...rest } = props;
                                                        return (
                                                            <li key={key} {...rest} style={{ display: 'flex', alignItems: 'center', color: '#1976d2', fontWeight: 500 }}>
                                                                <AddIcon fontSize="small" style={{ marginRight: 8 }} /> Neue Nationalität anlegen...
                                                            </li>
                                                        );
                                                    }
                                                    const { key, ...rest } = props;
                                                    return (
                                                        <li key={key} {...rest}>{option.name}</li>
                                                    );
                                                }}
                                                renderInput={(params) => (
                                                    <TextField {...params} label="Nationalität" fullWidth margin="normal" required />
                                                )}
                                                isOptionEqualToValue={(option, value) => option.id === value.id}
                                                sx={{ minWidth: 180 }}
                                            />
                                            <TextField
                                                label="Start"
                                                type="date"
                                                value={assignment.startDate || ''}
                                                onChange={e => handleNationalityAssignmentChange(assignment.id, 'startDate', e.target.value)}
                                                sx={{ minWidth: 120 }}
                                                required
                                                slotProps={{
                                                    inputLabel: { shrink: true }
                                                }}
                                            />
                                            <TextField
                                                label="Ende"
                                                type="date"
                                                value={assignment.endDate || ''}
                                                onChange={e => handleNationalityAssignmentChange(assignment.id, 'endDate', e.target.value)}
                                                sx={{ minWidth: 120 }}
                                                slotProps={{
                                                    inputLabel: { shrink: true }
                                                }}
                                            />
                                            <IconButton onClick={() => handleRemoveNationalityAssignment(assignment.id)} color="error" size="small"><DeleteIcon /></IconButton>
                                        </Box>
                                        ))}
                                        <Button onClick={handleAddNationalityAssignment} startIcon={<AddIcon />} size="small" sx={{ mt: 1 }}>Nationalität hinzufügen</Button>
                                    </Box>
                                </Stack>
                            </Box>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 2,
                                mt: 2,
                                mb: 1
                            }}>
                            <Button onClick={onCoachEditModalClose} variant="outlined" color="secondary">
                                Abbrechen
                            </Button>
                            <Button type="submit" variant="contained" color="primary" disabled={saving}>
                                {saving ? <CircularProgress size={20} /> : 'Speichern'}
                            </Button>
                        </Box>
                    </form>
                </>
                )}
            </BaseModal>
            <ClubEditModal
                openClubEditModal={openClubModal}
                onClubEditModalClose={() => setOpenClubModal(false)}
                clubId={clubModalId !== null && (coach?.clubAssignments ?? []).find((a: any) => a.id === clubModalId)?.club ? (coach.clubAssignments ?? []).find((a: any) => a.id === clubModalId).club.id : null}
                onClubSaved={(newClub) => {
                    setAllClubs(prev => [...prev, newClub]);
                    if (clubModalId !== null) {
                        handleClubAssignmentChange(clubModalId, 'club', newClub);
                    }
                    setOpenClubModal(false);
                }}
            />
            <CoachLicenseEditModal
                openCoachLicenseEditModal={openLicenseModal}
                onCoachLicenseEditModalClose={() => setOpenLicenseModal(false)}
                coachLicenseId={licenseModalId !== null && (coach?.licenseAssignments ?? []).find((a: any) => a.id === licenseModalId)?.license ? (coach.licenseAssignments ?? []).find((a: any) => a.id === licenseModalId).license.id : null}
                onCoachLicenseSaved={(newLicense) => {
                    setAllLicenses(prev => [...prev, newLicense]);
                    if (licenseModalId !== null) {
                        handleLicenseAssignmentChange(licenseModalId, 'license', newLicense);
                    }
                    setOpenLicenseModal(false);
                }}
            />
            <NationalityEditModal
                openNationalityEditModal={openNationalityModal}
                onNationalityEditModalClose={() => setOpenNationalityModal(false)}
                nationalityId={nationalityModalId !== null && (coach?.nationalityAssignments ?? []).find((a: any) => a.id === nationalityModalId)?.nationality ? (coach.nationalityAssignments ?? []).find((a: any) => a.id === nationalityModalId).nationality.id : null}
                onNationalitySaved={(newNationality) => {
                    setAllNationalities(prev => [...prev, newNationality]);
                    if (nationalityModalId !== null) {
                        handleNationalityAssignmentChange(nationalityModalId, 'nationality', newNationality);
                    }
                    setOpenNationalityModal(false);
                }}
            />
        </>
    );
};

export default CoachEditModal;
