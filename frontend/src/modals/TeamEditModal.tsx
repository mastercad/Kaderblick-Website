import React, { useEffect, useState } from 'react';
import {
    Button, Box, Typography, TextField, InputAdornment, Switch, FormControlLabel, CircularProgress, Alert, Divider
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import AddIcon from '@mui/icons-material/Add';
import AgeGroupEditModal from './AgeGroupEditModal';
import LeagueEditModal from './LeagueEditModal';
import { AgeGroup } from '../types/ageGroup';
import { League } from '../types/league';
import { Team } from '../types/team';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';
import TeamBannerSection from '../components/TeamBannerSection';

interface TeamEditModalProps {
    openTeamEditModal: boolean;
    teamId: number | null;
    onTeamEditModalClose: () => void;
    onTeamSaved?: (team: Team) => void;
}

const TeamEditModal: React.FC<TeamEditModalProps> = ({ openTeamEditModal, teamId, onTeamEditModalClose, onTeamSaved }) => {
    const [team, setTeam] = useState<any>(null);
    const [bannerImage, setBannerImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
    const [leagues, setLeagues] = useState<League[]>([]);
    const [ageGroupsLoading, setAgeGroupsLoading] = useState(false);
    const [ageGroupEditModalOpen, setAgeGroupEditModalOpen] = useState(false);
    const [leaguesLoading, setLeagueLoading] = useState(false);
    const [leagueEditModalOpen, setLeagueEditModalOpen] = useState(false);

    const [fieldErrors, setFieldErrors] = useState<{ name?: string; ageGroup?: string, league?: string }>({});

    useEffect(() => {
        setError(null);
        if (openTeamEditModal) {
            loadAgeGroups();
            loadLeagues();
        }
    }, [openTeamEditModal]);

    useEffect(() => {
        if (openTeamEditModal && teamId) {
            setLoading(true);
            apiJson(`/api/teams/${teamId}/details`)
                .then(data => {
                    setTeam(data.team);
                    setBannerImage(data.team?.bannerImage ?? null);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden des Teams.');
                    setLoading(false);
                });
        } else if (openTeamEditModal) {
            setTeam(null);
        }
    }, [openTeamEditModal, teamId]);

    const loadAgeGroups = () => {
        setAgeGroupsLoading(true);
        apiJson('/api/age-groups')
        .then((res) => {
            setAgeGroups(Array.isArray(res.ageGroups) ? res.ageGroups : []);
        })
        .catch(() => setAgeGroups([]))
        .finally(() => setAgeGroupsLoading(false));
    };

    const loadLeagues = () => {
        setLeagueLoading(true);
        apiJson('/api/leagues')
        .then((res) => {
            setLeagues(Array.isArray(res.leagues) ? res.leagues : []);
        })
        .catch(() => setLeagues([]))
        .finally(() => setLeagueLoading(false));
    };

    const handleTeamEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setTeam((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : type === 'number' ? (value === '' ? null : Number(value)) : value
        }));
    };

    const handleTeamEditSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            let errors: { name?: string; ageGroup?: string; league?: string} = {};
            if (!team?.name || team.name.trim() === '') {
                    errors.name = 'Name ist erforderlich';
            }
            if (!team?.ageGroup || !team.ageGroup.id) {
                    errors.ageGroup = 'Altersgruppe ist erforderlich';
            }
            if (!team?.league || !team.league.id) {
                    errors.league = 'Liga ist erforderlich';
            }
            setFieldErrors(errors);
            if (Object.keys(errors).length > 0) {
                    return;
            }
            setLoading(true);
            setError(null);
            try {
                const url = team.id ? `/api/teams/${team.id}` : '/api/teams';
                const method = team.id ? 'PUT' : 'POST';
                const res = await apiJson(url, {
                    method,
                    body: team,
                    headers: { 'Content-Type': 'application/json' },
                });

                if (onTeamSaved) onTeamSaved(res.team || res.data || team);
                onTeamEditModalClose();
            } catch (err: any) {
                setError(err?.message || 'Fehler beim Speichern');
            } finally {
                setLoading(false);
            }
    };

    return (
        <>
            <BaseModal
                open={openTeamEditModal}
                onClose={onTeamEditModalClose}
                maxWidth="md"
                title="Team bearbeiten"
            >
                {loading ? (
                    <Box display="flex" alignItems="center" justifyContent="center" minHeight={200}>
                        <CircularProgress />
                    </Box>
                ) : (
                <>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2, fontWeight: 'bold', fontSize: '1.1em' }}>
                            {error}
                        </Alert>
                    )}
                    <form id="teamEditForm" autoComplete="off" onSubmit={handleTeamEditSubmit}>
                        <input type="hidden" name="id" value={team?.id} />
                        <Box className="modal-body" sx={{ bgcolor: 'background.default', p: 0 }}>
                            {teamId && (
                                <Box mb={3}>
                                    <TeamBannerSection
                                        teamId={teamId}
                                        bannerImage={bannerImage}
                                        canEditBanner={team?.permissions?.canEditBanner ?? true}
                                        onBannerChange={setBannerImage}
                                    />
                                </Box>
                            )}
                            <Box mb={4} pb={2} borderBottom={1} borderColor="divider">
                                <Typography variant="h6" color="primary" mb={3} display="flex" alignItems="center">
                                    Stammdaten
                                </Typography>
                                <Box display="flex" flexWrap="wrap" gap={2}>
                                    <Box flex={1} minWidth={250}>
                                        <TextField label="Name" name="name" value={team?.name || ''} onChange={handleTeamEditChange} required fullWidth margin="normal"
                                            error={!!fieldErrors.name}
                                            helperText={fieldErrors.name}
                                        />
                                    </Box>
                                    <Box flex={1} minWidth={250}>
                                        <Autocomplete
                                            options={(() => {
                                                const filtered = ageGroups;
                                                return [
                                                    ...filtered,
                                                    { id: 'new', name: 'Neue Altersgruppe anlegen...' }
                                                ];
                                            })()}
                                            loading={ageGroupsLoading}
                                            getOptionLabel={(option) => option.name}
                                            value={team?.ageGroup && ageGroups.length > 0 ? ageGroups.find(l => l.id === team.ageGroup.id) || null : null}
                                            onChange={(_, newValue) => {
                                                if (newValue && (newValue as any).id === 'new') {
                                                    setAgeGroupEditModalOpen(true);
                                                } else {
                                                    setTeam((prev: any) => ({ ...prev, ageGroup: newValue }));
                                                    setFieldErrors((prev) => ({ ...prev, ageGroup: undefined }));
                                                }
                                            }}
                                            renderOption={(props, option) => {
                                                if ((option as any).id === 'new') {
                                                    return (
                                                        <li {...props} style={{ display: 'flex', alignItems: 'center', color: '#1976d2', fontWeight: 500 }}>
                                                            <AddIcon fontSize="small" style={{ marginRight: 8 }} /> Neue Altersgruppe anlegen...
                                                        </li>
                                                    );
                                                }
                                                return (
                                                    <li {...props}>{option.name}</li>
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField placeholder='Mindestens 2 Buchstaben für Suche eingeben...'
                                                    {...params}
                                                    label="Altersgruppe"
                                                    fullWidth margin="normal"
                                                    error={!!fieldErrors.ageGroup}
                                                    helperText={fieldErrors.ageGroup}
                                                />
                                            )}
                                            isOptionEqualToValue={(option, value) => option.id === value.id}
                                            filterOptions={(options, { inputValue }) => {
                                                if (inputValue.length < 2) return options.filter(o => (o as any).id === 'new');
                                                const filtered = options.filter(option =>
                                                    option.name.toLowerCase().includes(inputValue.toLowerCase())
                                                );
                                                return [
                                                    ...filtered.filter(o => (o as any).id !== 'new'),
                                                    ...options.filter(o => (o as any).id === 'new')
                                                ];
                                            }}
                                            noOptionsText="Keine Altersgruppe gefunden (mind. 2 Zeichen)"
                                        />
                                    </Box>
                                    <Box flex={1} minWidth={250}>
                                        <Autocomplete
                                            options={(() => {
                                                const filtered = leagues;
                                                return [
                                                    ...filtered,
                                                    { id: 'new', name: 'Neue Liga anlegen...' }
                                                ];
                                            })()}
                                            loading={leaguesLoading}
                                            getOptionLabel={(option) => option.name}
                                            value={team?.league && leagues.length > 0 ? leagues.find(l => l.id === team.league.id) || null : null}
                                            onChange={(_, newValue) => {
                                                if (newValue && (newValue as any).id === 'new') {
                                                    setLeagueEditModalOpen(true);
                                                } else {
                                                    setTeam((prev: any) => ({ ...prev, league: newValue }));
                                                    setFieldErrors((prev) => ({ ...prev, league: undefined }));
                                                }
                                            }}
                                            renderOption={(props, option) => {
                                                if ((option as any).id === 'new') {
                                                    return (
                                                        <li {...props} style={{ display: 'flex', alignItems: 'center', color: '#1976d2', fontWeight: 500 }}>
                                                            <AddIcon fontSize="small" style={{ marginRight: 8 }} />
                                                            Neue Liga anlegen...
                                                        </li>
                                                    );
                                                }
                                                return (
                                                    <li {...props}>{option.name}</li>
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField placeholder='Mindestens 2 Buchstaben für Suche eingeben...'
                                                    {...params}
                                                    label="Liga"
                                                    fullWidth margin="normal"
                                                    error={!!fieldErrors.league}
                                                    helperText={fieldErrors.league}
                                                />
                                            )}
                                            isOptionEqualToValue={(option, value) => option.id === value.id}
                                            filterOptions={(options, { inputValue }) => {
                                                if (inputValue.length < 2) return options.filter(o => (o as any).id === 'new');
                                                const filtered = options.filter(option =>
                                                    option.name.toLowerCase().includes(inputValue.toLowerCase())
                                                );
                                                return [
                                                    ...filtered.filter(o => (o as any).id !== 'new'),
                                                    ...options.filter(o => (o as any).id === 'new')
                                                ];
                                            }}
                                            noOptionsText="Keine Liga gefunden (mind. 2 Zeichen)"
                                        />
                                    </Box>
                                </Box>
                            </Box>

                            <Box mb={4} pb={2} borderBottom={1} borderColor="divider">
                                <Typography variant="h6" color="primary" mb={3} display="flex" alignItems="center">
                                    fussball.de Optionen
                                </Typography>
                                <Box display="flex" flexWrap="wrap" gap={2}>
                                    <Box flex={1} minWidth={250}>
                                        <TextField label="fussball.de ID" name="fussballDeId" value={team?.fussballDeId || ''} onChange={handleTeamEditChange} fullWidth margin="normal" />
                                    </Box>
                                    <Box flex={1} minWidth={250}>
                                        <TextField label="fussball.de URL" name="fussballDeUrl" value={team?.fussballDeUrl || ''} onChange={handleTeamEditChange} fullWidth margin="normal" />
                                    </Box>
                                </Box>
                                <Box mt={2} mb={1}>
                                    <Button type="button" variant="outlined" color="info" startIcon={null}>
                                        fussball.de-Daten laden
                                    </Button>
                                    {/* TODO: Loading spinner for fussball.de */}
                                </Box>
                            </Box>

                            <Box mb={4} pb={2}>
                                <Typography variant="h6" color="primary" mb={1} display="flex" alignItems="center">
                                    Spielzeiten-Vorgaben
                                </Typography>
                                <Typography variant="body2" color="text.secondary" mb={2}>
                                    Diese Werte werden beim Erstellen neuer Spiele vorausgefüllt. Leer lassen für Standard (45 / 15 Min.).
                                </Typography>
                                <Box display="flex" flexWrap="wrap" gap={2}>
                                    <Box flex={1} minWidth={200}>
                                        <TextField
                                            label="Halbzeit-Dauer (Min.)"
                                            name="defaultHalfDuration"
                                            type="number"
                                            value={team?.defaultHalfDuration ?? ''}
                                            onChange={handleTeamEditChange}
                                            inputProps={{ min: 1, max: 90, step: 1 }}
                                            fullWidth
                                            margin="normal"
                                            placeholder="45"
                                            helperText="Standard: 45 Min."
                                        />
                                    </Box>
                                    <Box flex={1} minWidth={200}>
                                        <TextField
                                            label="Halbzeit-Pause (Min.)"
                                            name="defaultHalftimeBreakDuration"
                                            type="number"
                                            value={team?.defaultHalftimeBreakDuration ?? ''}
                                            onChange={handleTeamEditChange}
                                            inputProps={{ min: 0, max: 60, step: 1 }}
                                            fullWidth
                                            margin="normal"
                                            placeholder="15"
                                            helperText="Standard: 15 Min."
                                        />
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                        <Divider />
                        <Box display="flex" justifyContent="flex-end" gap={2} mt={2} mb={1}>
                            <Button onClick={onTeamEditModalClose} variant="outlined" color="secondary">
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
            <AgeGroupEditModal
                openAgeGroupEditModal={ageGroupEditModalOpen}
                ageGroupId={null}
                onAgeGroupEditModalClose={() => setAgeGroupEditModalOpen(false)}
                onAgeGroupSaved={(newAgeGroup) => {
                    setAgeGroupEditModalOpen(false);
                    if (newAgeGroup && newAgeGroup.id) {
                        loadAgeGroups();
                        setAgeGroups(prev => [...prev, newAgeGroup]);

                        if (!team) {
                            setTeam({ ageGroup: newAgeGroup })
                            return;
                        }
                        setTeam((prev: Team) => {
                            if (!prev) return prev;
                            return { ...prev, ageGroup: newAgeGroup };
                        });
                    }
                }}
            />
            <LeagueEditModal
                openLeagueEditModal={leagueEditModalOpen}
                leagueId={null}
                onLeagueEditModalClose={() => setLeagueEditModalOpen(false)}
                onLeagueSaved={(newLeague) => {
                    setLeagueEditModalOpen(false);
                    if (newLeague && newLeague.id) {
                        loadLeagues();
                        setLeagues(prev => [...prev, newLeague]);

                        if (!team) {
                            setTeam({ league: newLeague })
                            return;
                        }
                        setTeam((prev: Team) => {
                            if (!prev) return prev;
                            return { ...prev, league: newLeague };
                        });
                    }
                }}
            />
        </>
    );
};

export default TeamEditModal;
