import React, { useEffect, useState } from 'react';
import {
    Button, Box, Typography, TextField, InputAdornment, Switch, FormControlLabel, CircularProgress, Alert, Divider
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import AddIcon from '@mui/icons-material/Add';
import LocationEditModal from './LocationEditModal';
import { Location } from '../types/location';
import { Club } from '../types/club';
import { apiJson } from '../utils/api';
import BaseModal from './BaseModal';

interface ClubEditModalProps {
    openClubEditModal: boolean;
    clubId: number | null;
    onClubEditModalClose: () => void;
    onClubSaved?: (club: Club) => void;
}

const ClubEditModal: React.FC<ClubEditModalProps> = ({ openClubEditModal, clubId, onClubEditModalClose, onClubSaved }) => {
    const [club, setClub] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locations, setLocations] = useState<Location[]>([]);
    const [locationsLoading, setLocationsLoading] = useState(false);
    const [locationEditModalOpen, setLocationEditModalOpen] = useState(false);

    const [fieldErrors, setFieldErrors] = useState<{ name?: string; location?: string }>({});

    useEffect(() => {
        if (openClubEditModal) {
            loadLocations();
        }
    }, [openClubEditModal]);

    useEffect(() => {
        if (openClubEditModal && clubId) {
            setLoading(true);
            apiJson(`/clubs/${clubId}/details`)
                .then(data => {
                    setClub(data.club);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Vereinsdaten.');
                    setLoading(false);
                });
        } else if (openClubEditModal) {
            setClub(null);
        }
    }, [openClubEditModal, clubId]);

    const loadLocations = () => {
        setLocationsLoading(true);
        apiJson('/api/locations')
        .then((res) => {
            setLocations(Array.isArray(res.locations) ? res.locations : []);
        })
        .catch(() => setLocations([]))
        .finally(() => setLocationsLoading(false));
    };

    const handleClubEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setClub((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

        const handleClubEditSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                let errors: { name?: string; location?: string } = {};
                if (!club?.name || club.name.trim() === '') {
                        errors.name = 'Name ist erforderlich';
                }
                if (!club?.location || !club.location.id) {
                        errors.location = 'Sportstätte ist erforderlich';
                }
                setFieldErrors(errors);
                if (Object.keys(errors).length > 0) {
                        return;
                }
                setLoading(true);
                setError(null);
                try {
                    const url = club.id ? `/clubs/${club.id}` : '/clubs';
                    const method = club.id ? 'PUT' : 'POST';
                    const res = await apiJson(url, {
                        method,
                        body: club,
                        headers: { 'Content-Type': 'application/json' },
                    });

                    if (onClubSaved) onClubSaved(res.club || res.data || club);
                    onClubEditModalClose();
                } catch (err: any) {
                    setError(err?.message || 'Fehler beim Speichern');
                } finally {
                    setLoading(false);
                }
        };

    return (
        <>
            <BaseModal
                open={openClubEditModal}
                onClose={onClubEditModalClose}
                maxWidth="md"
                title="Verein bearbeiten"
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
                    <form id="clubEditForm" autoComplete="off" onSubmit={handleClubEditSubmit}>
                        <input type="hidden" name="id" value={club?.id} />
                        <Box className="modal-body" sx={{ bgcolor: 'background.default', p: 0 }}>
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
                                        flex: 1,
                                        minWidth: 250,
                                        display: "flex",
                                        alignItems: "center"
                                    }}>
                                    <FormControlLabel
                                        control={<Switch checked={!!club?.active} onChange={e => setClub((prev: any) => ({ ...prev, active: e.target.checked }))} name="active" color="success" />}
                                        label="Aktiv"
                                    />
                                </Box>
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
                                        <TextField label="Name" name="name" value={club?.name || ''} onChange={handleClubEditChange} required fullWidth margin="normal"
                                            error={!!fieldErrors.name}
                                            helperText={fieldErrors.name}
                                        />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Kurzname" name="shortName" value={club?.shortName || ''} onChange={handleClubEditChange} fullWidth margin="normal" />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Ausstattung" name="abbreviation" value={club?.abbreviation || ''} onChange={handleClubEditChange} fullWidth margin="normal" />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Stadion" name="stadiumName" value={club?.stadiumName || ''} onChange={handleClubEditChange} fullWidth margin="normal" />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Vereinsfarben" name="clubColors" value={club?.clubColors || ''} onChange={handleClubEditChange} fullWidth margin="normal" />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Ansprechpartner" name="contactPerson" value={club?.contactPerson || ''} onChange={handleClubEditChange} fullWidth margin="normal" />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Gründungsjahr" name="foundingYear" type="number" value={club?.foundingYear || ''} onChange={handleClubEditChange} fullWidth margin="normal" slotProps={{
                                            htmlInput: { min: 1800, max: 2100 }
                                        }} />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <Autocomplete
                                            options={(() => {
                                                const filtered = locations;
                                                return [
                                                    ...filtered,
                                                    { id: 'new', name: 'Neue Sportstätte anlegen...' }
                                                ];
                                            })()}
                                            loading={locationsLoading}
                                            getOptionLabel={(option) => option.name}
                                            value={club?.location && locations.length > 0 ? locations.find(l => l.id === club.location.id) || null : null}
                                            onChange={(_, newValue) => {
                                                if (newValue && (newValue as any).id === 'new') {
                                                    setLocationEditModalOpen(true);
                                                } else {
                                                    setClub((prev: any) => ({ ...prev, location: newValue }));
                                                    setFieldErrors((prev) => ({ ...prev, location: undefined }));
                                                }
                                            }}
                                            renderOption={(props, option) => {
                                                if ((option as any).id === 'new') {
                                                    return (
                                                        <li {...props} key={option.id} style={{ display: 'flex', alignItems: 'center', color: '#1976d2', fontWeight: 500 }}>
                                                            <AddIcon fontSize="small" style={{ marginRight: 8 }} /> Neue Sportstätte anlegen...
                                                        </li>
                                                    );
                                                }
                                                return (
                                                    <li {...props} key={option.id}>{option.name}</li>
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField placeholder='Mindestens 2 Buchstaben für Suche eingeben...'
                                                    {...params}
                                                    label="Sportstätte"
                                                    fullWidth margin="normal"
                                                    error={!!fieldErrors.location}
                                                    helperText={fieldErrors.location}
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
                                            noOptionsText="Keine Sportstätte gefunden (mind. 2 Zeichen)"
                                        />
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
                                    Kontakt & Web
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
                                        <TextField label="Website" name="website" value={club?.website || ''} onChange={handleClubEditChange} fullWidth margin="normal" slotProps={{
                                            input: { startAdornment: <InputAdornment position="start">🌐</InputAdornment> }
                                        }} />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="E-Mail" name="email" value={club?.email || ''} onChange={handleClubEditChange} fullWidth margin="normal" slotProps={{
                                            input: { startAdornment: <InputAdornment position="start">✉️</InputAdornment> }
                                        }} />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Telefon" name="phone" value={club?.phone || ''} onChange={handleClubEditChange} fullWidth margin="normal" slotProps={{
                                            input: { startAdornment: <InputAdornment position="start">📞</InputAdornment> }
                                        }} />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="Logo-URL" name="logoUrl" value={club?.logoUrl || ''} onChange={handleClubEditChange} fullWidth margin="normal" />
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
                                    fussball.de Optionen
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
                                        <TextField label="fussball.de ID" name="fussballDeId" value={club?.fussballDeId || ''} onChange={handleClubEditChange} fullWidth margin="normal" />
                                    </Box>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 250
                                        }}>
                                        <TextField label="fussball.de URL" name="fussballDeUrl" value={club?.fussballDeUrl || ''} onChange={handleClubEditChange} fullWidth margin="normal" />
                                    </Box>
                                </Box>
                                <Box
                                    sx={{
                                        mt: 2,
                                        mb: 1
                                    }}>
                                    <Button type="button" variant="outlined" color="info" startIcon={null}>
                                        fussball.de-Daten laden
                                    </Button>
                                    {/* TODO: Loading spinner for fussball.de */}
                                </Box>
                            </Box>
                        </Box>
                        <Divider />
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 2,
                                mt: 2,
                                mb: 1
                            }}>
                            <Button onClick={onClubEditModalClose} variant="outlined" color="secondary">
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
            <LocationEditModal
                openLocationEditModal={locationEditModalOpen}
                onLocationEditModalClose={() => setLocationEditModalOpen(false)}
                isEdit={false}
                onLocationSaved={(newLocation: Location) => {
                    setLocationEditModalOpen(false);
                    if (newLocation && newLocation.id) {
                        loadLocations();
                
                        setLocations(prev => [...prev, newLocation]);

                        if (!club) {
                            setClub({ location: newLocation })
                            return;
                        }
                        setClub((prev: Club) => {
                            if (!prev) return prev;
                            return { ...prev, location: newLocation };
                        });
                    }
                }}
            />
        </>
    );
};

export default ClubEditModal;
