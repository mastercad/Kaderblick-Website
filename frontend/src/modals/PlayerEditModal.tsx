import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    Button, Box, Typography, TextField, InputAdornment, CircularProgress, Alert, Divider, Chip, Stack, IconButton
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
//import PlayerLicenseEditModal from './PlayerLicenseEditModal';
import NationalityEditModal from './NationalityEditModal';
import ClubEditModal from './ClubEditModal';
//import { PlayerLicense } from '../types/playerLicense';
import { Nationality } from '../types/nationality';
import { Player } from '../types/player';
import { Club } from '../types/club';
import { Team } from '../types/team';
import { apiJson } from '../utils/api';
import { toDateInputValue } from '../utils/date';
import { PlayerTeamAssignmentType } from '../types/playerTeamAssignmentType';
import { StrongFeet } from '../types/strongFeet';
import { Position } from '../types/position';
import BaseModal from './BaseModal';

// ---------------------------------------------------------------------------
// Memoized sub-components – prevent sibling rows from re-rendering on input
// ---------------------------------------------------------------------------

interface ClubAssignmentRowProps {
    assignment: any;
    canEditStammdaten: boolean;
    allClubs: Club[];
    onChange: (id: number, field: string, value: any) => void;
    onRemove: (id: number) => void;
    onOpenNewClubModal: (assignmentId: number) => void;
}
const ClubAssignmentRow = React.memo<ClubAssignmentRowProps>(({ assignment, canEditStammdaten, allClubs, onChange, onRemove, onOpenNewClubModal }) => {
    const options = useMemo(
        () => canEditStammdaten !== false ? [...allClubs, { id: 'new', name: 'Neuen Verein anlegen...' } as unknown as Club] : allClubs,
        [allClubs, canEditStammdaten]
    );
    return (
        <Box
            sx={[{
                display: "flex",
                gap: 2,
                alignItems: "center",
                mb: 1
            }, canEditStammdaten === false ? { pointerEvents: 'none' } : {}]}>
            <Autocomplete
                options={options}
                getOptionLabel={(option) => option.name}
                value={assignment.club || null}
                onChange={(_, newValue) => {
                    if (newValue && (newValue as any).id === 'new') {
                        onOpenNewClubModal(assignment.id);
                    } else {
                        onChange(assignment.id, 'club', newValue);
                    }
                }}
                renderOption={(props, option) => {
                    if ((option as any).id === 'new') {
                        const { key, ...rest } = props;
                        return (
                            <li key={key} {...rest} style={{ display: 'flex', alignItems: 'center', color: '#1976d2', fontWeight: 500 }}>
                                <AddIcon fontSize="small" style={{ marginRight: 8 }} />
                                Neuen Verein anlegen...
                            </li>
                        );
                    }
                    const { key, ...rest } = props;
                    return <li key={key} {...rest}>{option.name}</li>;
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
                onChange={e => onChange(assignment.id, 'startDate', e.target.value)}
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
                onChange={e => onChange(assignment.id, 'endDate', e.target.value)}
                sx={{ minWidth: 120 }}
                slotProps={{
                    inputLabel: { shrink: true }
                }}
            />
            {canEditStammdaten !== false && (
                <IconButton onClick={() => onRemove(assignment.id)} color="error" size="small"><DeleteIcon /></IconButton>
            )}
        </Box>
    );
});

interface TeamAssignmentRowProps {
    assignment: any;
    allTeams: Team[];
    allPlayerTeamAssignmentTypes: PlayerTeamAssignmentType[];
    onChange: (id: number | null, field: string, value: any) => void;
    onRemove: (id: number | null) => void;
}
const TeamAssignmentRow = React.memo<TeamAssignmentRowProps>(({ assignment, allTeams, allPlayerTeamAssignmentTypes, onChange, onRemove }) => {
    const ptaEditable = assignment.id === null || assignment.canEdit !== false;
    return (
        <Box
            sx={[{
                display: "flex",
                gap: 2,
                alignItems: "center",
                mb: 1
            }, !ptaEditable ? { opacity: 0.55, pointerEvents: 'none' } : {}]}>
            <Autocomplete
                options={allTeams}
                getOptionLabel={(option) => option.name}
                value={assignment.team || null}
                onChange={(_, newValue) => onChange(assignment.id, 'team', newValue)}
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
                onChange={e => onChange(assignment.id, 'type', e.target.value)}
                sx={{ minWidth: 140 }}
                slotProps={{
                    select: { native: true }
                }}
            >
                <option value="">Typ wählen...</option>
                {allPlayerTeamAssignmentTypes.map(assignmentType => (
                    <option key={assignmentType.id} value={String(assignmentType.id)}>{assignmentType.name}</option>
                ))}
            </TextField>
            <Box
                sx={{
                    flex: 1,
                    minWidth: 80
                }}>
                <TextField
                    label="Trikot Nummer"
                    name="shirtNumber"
                    value={assignment.shirtNumber || ''}
                    onChange={e => onChange(assignment.id, 'shirtNumber', e.target.value)}
                    fullWidth
                    required
                    slotProps={{
                        input: { startAdornment: <InputAdornment position="start">#</InputAdornment> }
                    }}
                />
            </Box>
            <TextField
                label="Start"
                type="date"
                value={assignment.startDate || ''}
                onChange={e => onChange(assignment.id, 'startDate', e.target.value)}
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
                onChange={e => onChange(assignment.id, 'endDate', e.target.value)}
                sx={{ minWidth: 120 }}
                slotProps={{
                    inputLabel: { shrink: true }
                }}
            />
            {ptaEditable && (
                <IconButton onClick={() => onRemove(assignment.id)} color="error" size="small"><DeleteIcon /></IconButton>
            )}
        </Box>
    );
});

interface NationalityAssignmentRowProps {
    assignment: any;
    canEditStammdaten: boolean;
    allNationalities: Nationality[];
    onChange: (id: number, field: string, value: any) => void;
    onRemove: (id: number) => void;
    onOpenNewNationalityModal: (assignmentId: number) => void;
}
const NationalityAssignmentRow = React.memo<NationalityAssignmentRowProps>(({ assignment, canEditStammdaten, allNationalities, onChange, onRemove, onOpenNewNationalityModal }) => {
    const options = useMemo(
        () => canEditStammdaten !== false ? [...allNationalities, { id: 'new', name: 'Neue Nationalität anlegen...' } as unknown as Nationality] : allNationalities,
        [allNationalities, canEditStammdaten]
    );
    return (
        <Box
            sx={[{
                display: "flex",
                gap: 2,
                alignItems: "center",
                mb: 1
            }, canEditStammdaten === false ? { pointerEvents: 'none' } : {}]}>
            <Autocomplete
                options={options}
                getOptionLabel={(option) => option.name}
                value={assignment.nationality || null}
                onChange={(_, newValue) => {
                    if (newValue && (newValue as any).id === 'new') {
                        onOpenNewNationalityModal(assignment.id);
                    } else {
                        onChange(assignment.id, 'nationality', newValue);
                    }
                }}
                renderOption={(props, option) => {
                    if ((option as any).id === 'new') {
                        const { key, ...rest } = props;
                        return (
                            <li key={key} {...rest} style={{ display: 'flex', alignItems: 'center', color: '#1976d2', fontWeight: 500 }}>
                                <AddIcon fontSize="small" style={{ marginRight: 8 }} />
                                Neue Nationalität anlegen...
                            </li>
                        );
                    }
                    const { key, ...rest } = props;
                    return <li key={key} {...rest}>{option.name}</li>;
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
                onChange={e => onChange(assignment.id, 'startDate', e.target.value)}
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
                onChange={e => onChange(assignment.id, 'endDate', e.target.value)}
                sx={{ minWidth: 120 }}
                slotProps={{
                    inputLabel: { shrink: true }
                }}
            />
            <IconButton onClick={() => onRemove(assignment.id)} color="error" size="small">
                <DeleteIcon />
            </IconButton>
        </Box>
    );
});

// ---------------------------------------------------------------------------

// Separate memo for the expensive Autocomplete multiple — skips re-render when
// typing in other fields (alternativePositions reference stays stable via setFields spread).
interface AltPositionsFieldProps {
    options: Position[];
    value: Position[];
    onChange: (newValue: Position[]) => void;
}
const AltPositionsField = React.memo<AltPositionsFieldProps>(
    ({ options, value, onChange }) => {
        const handleChange = useCallback((_: any, newValue: Position[]) => {
            onChange(newValue);
        }, [onChange]);
        return (
            <Autocomplete
                multiple
                options={options}
                getOptionLabel={option => option.name}
                value={value}
                onChange={handleChange}
                renderValue={(tagValue, getItemProps) =>
                    tagValue.map((option: Position, index: number) => (
                        <Chip label={option.name} {...getItemProps({ index })} key={option.id} />
                    ))
                }
                renderInput={params => (
                    <TextField {...params} label="Alternative Positionen" placeholder="Position(en) wählen..." margin="normal" fullWidth />
                )}
                isOptionEqualToValue={(option, val) => option.id === val.id}
                sx={{ minWidth: 250 }}
            />
        );
    },
    (prev, next) => prev.value === next.value && prev.options === next.options && prev.onChange === next.onChange
);

export interface StammdatenSectionHandle {
    getFields: () => any;
}

interface StammdatenSectionProps {
    initialPlayer: any;
    canEdit: boolean;
    allStrongFeets: StrongFeet[];
    allPlayerPositions: Position[];
}

// forwardRef + memo: typing NEVER triggers a parent re-render.
// The parent reads current values via ref.getFields() only on submit.
const StammdatenSection = React.memo(
    React.forwardRef<StammdatenSectionHandle, StammdatenSectionProps>(
        ({ initialPlayer, canEdit, allStrongFeets, allPlayerPositions }, ref) => {
            const [fields, setFields] = useState<any>(() => ({
                firstName: initialPlayer?.firstName || '',
                lastName: initialPlayer?.lastName || '',
                birthdate: initialPlayer?.birthdate || '',
                email: initialPlayer?.email || '',
                strongFeet: initialPlayer?.strongFeet || null,
                mainPosition: initialPlayer?.mainPosition || null,
                alternativePositions: initialPlayer?.alternativePositions || [],
            }));

            // Keep a ref always in sync so imperative reads are current without causing re-renders
            const fieldsRef = useRef(fields);
            fieldsRef.current = fields;

            useImperativeHandle(ref, () => ({
                getFields: () => fieldsRef.current,
            }), []);

            // Re-initialize when a different player is loaded (id changes)
            const prevIdRef = useRef<any>(initialPlayer?.id);
            useEffect(() => {
                if (initialPlayer?.id !== prevIdRef.current) {
                    prevIdRef.current = initialPlayer?.id;
                    setFields({
                        firstName: initialPlayer?.firstName || '',
                        lastName: initialPlayer?.lastName || '',
                        birthdate: initialPlayer?.birthdate || '',
                        email: initialPlayer?.email || '',
                        strongFeet: initialPlayer?.strongFeet || null,
                        mainPosition: initialPlayer?.mainPosition || null,
                        alternativePositions: initialPlayer?.alternativePositions || [],
                    });
                }
            }, [initialPlayer]);

            const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
                const { name, value, type, checked } = e.target;
                setFields((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
            }, []);

            const handleStrongFeetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
                const id = e.target.value ? parseInt(e.target.value, 10) : 0;
                const found = id ? allStrongFeets.find(f => f.id === id) || { id } : null;
                setFields((prev: any) => ({ ...prev, strongFeet: found }));
            }, [allStrongFeets]);

            const handleMainPositionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
                const id = e.target.value ? parseInt(e.target.value, 10) : 0;
                const found = id ? allPlayerPositions.find(p => p.id === id) || { id } : null;
                setFields((prev: any) => ({ ...prev, mainPosition: found }));
            }, [allPlayerPositions]);

            const handleAltPositionsChange = useCallback((newValue: Position[]) => {
                setFields((prev: any) => ({ ...prev, alternativePositions: newValue }));
            }, []);

            return (
                <>
                    <Typography
                        variant="h6"
                        color="primary"
                        sx={{
                            mb: 3,
                            display: "flex",
                            alignItems: "center"
                        }}>
                        Stammdaten
                        {!canEdit && <Chip label="Nur Ansicht" size="small" sx={{ ml: 1 }} />}
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
                            <TextField label="Vorname" name="firstName" value={fields.firstName} onChange={handleInputChange} required fullWidth margin="normal" />
                        </Box>
                        <Box
                            sx={{
                                flex: 1,
                                minWidth: 250
                            }}>
                            <TextField label="Nachname" name="lastName" value={fields.lastName} onChange={handleInputChange} required fullWidth margin="normal" />
                        </Box>
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
                            <TextField
                                label="Geburtsdatum"
                                name="birthdate"
                                type="date"
                                value={fields.birthdate}
                                onChange={handleInputChange}
                                fullWidth
                                margin="normal"
                                slotProps={{
                                    inputLabel: { shrink: true }
                                }}
                            />
                        </Box>
                        <Box
                            sx={{
                                flex: 1,
                                minWidth: 250
                            }}>
                            <TextField label="E-Mail" name="email" value={fields.email} onChange={handleInputChange} fullWidth margin="normal" slotProps={{
                                input: { startAdornment: <InputAdornment position="start">✉️</InputAdornment> }
                            }} />
                        </Box>
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
                            <TextField
                                select
                                label="Starker Fuß"
                                value={fields.strongFeet?.id || ''}
                                onChange={handleStrongFeetChange}
                                required
                                fullWidth
                                margin="normal"
                                slotProps={{
                                    select: { native: true },
                                    inputLabel: { shrink: true }
                                }}>
                                <option value="">Starken Fuß wählen...</option>
                                {allStrongFeets.map(sf => (
                                    <option key={sf.id} value={String(sf.id)}>{sf.name}</option>
                                ))}
                            </TextField>
                        </Box>
                        <Box
                            sx={{
                                flex: 1,
                                minWidth: 250
                            }}>
                            <TextField
                                select
                                label="Hauptposition"
                                value={fields.mainPosition?.id || ''}
                                onChange={handleMainPositionChange}
                                fullWidth
                                required
                                margin="normal"
                                slotProps={{
                                    select: { native: true },
                                    inputLabel: { shrink: true }
                                }}>
                                <option value="">Hauptposition wählen...</option>
                                {allPlayerPositions.map(position => (
                                    <option key={position.id} value={String(position.id)}>{position.name}</option>
                                ))}
                            </TextField>
                        </Box>
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
                            <AltPositionsField
                                options={allPlayerPositions}
                                value={fields.alternativePositions}
                                onChange={handleAltPositionsChange}
                            />
                        </Box>
                    </Box>
                </>
            );
        }
    ),
    // Only re-render when a different player is opened or lookup data changes.
    // Never re-render due to parent player-state changes during typing.
    (prev, next) => (
        prev.initialPlayer?.id === next.initialPlayer?.id &&
        prev.canEdit === next.canEdit &&
        prev.allStrongFeets === next.allStrongFeets &&
        prev.allPlayerPositions === next.allPlayerPositions
    )
);

// ---------------------------------------------------------------------------

interface PlayerEditModalProps {
    openPlayerEditModal: boolean;
    playerId: number | null;
    onPlayerEditModalClose: () => void;
    onPlayerSaved?: (player: Player) => void;
}

const PlayerEditModal: React.FC<PlayerEditModalProps> = ({ openPlayerEditModal, playerId, onPlayerEditModalClose, onPlayerSaved }) => 
{
    // State für die Modals zum Anlegen
/*
    const [openLicenseModal, setOpenLicenseModal] = useState(false);
    const [licenseModalId, setLicenseModalId] = useState<number | null>(null);
*/
    const [openClubModal, setOpenClubModal] = useState(false);
    const [openNationalityModal, setOpenNationalityModal] = useState(false);
    // ID merken, für das Assignment das gerade editiert wird
    const [clubModalId, setClubModalId] = useState<number | null>(null);
    const [nationalityModalId, setNationalityModalId] = useState<number | null>(null);
    const [player, setPlayer] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Suche nach bestehendem Spieler (nur relevant beim Neuanlegen, playerId === null)
    const [showPlayerSearch, setShowPlayerSearch] = useState(false);
    const [playerSearchQuery, setPlayerSearchQuery] = useState('');
    const [playerSearchResults, setPlayerSearchResults] = useState<any[]>([]);
    const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stammdatenRef = useRef<StammdatenSectionHandle>(null);
    
    // Multi-Select States
    const [allClubs, setAllClubs] = useState<Club[]>([]);
    const [allPlayerTeamAssignmentTypes, setAllPlayerTeamAssignmentTypes] = useState<PlayerTeamAssignmentType[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [allPlayerPositions, setAllPositions] = useState<Position[]>([]);
    const [allStrongFeets, setAllStrongFeets] = useState<StrongFeet[]>([]);
    const [allNationalities, setAllNationalities] = useState<Nationality[]>([]);

    // Debounced Spielersuche (für die "Spieler bereits vorhanden?"-Suche)
    const handlePlayerSearchInput = useCallback((value: string) => {
        setPlayerSearchQuery(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (value.trim().length < 2) {
            setPlayerSearchResults([]);
            return;
        }
        searchDebounceRef.current = setTimeout(async () => {
            setPlayerSearchLoading(true);
            try {
                const res = await apiJson(`/api/players?search=${encodeURIComponent(value.trim())}&limit=10&searchAll=1`);
                setPlayerSearchResults(res.players || []);
            } catch {
                setPlayerSearchResults([]);
            } finally {
                setPlayerSearchLoading(false);
            }
        }, 300);
    }, []);

    const handleSelectExistingPlayer = useCallback(async (selectedPlayer: any) => {
        setPlayerSearchQuery('');
        setPlayerSearchResults([]);
        setShowPlayerSearch(false);
        setLoading(true);
        try {
            const data = await apiJson(`/api/players/${selectedPlayer.id}`);
            const p = data.player;
            if (p && Array.isArray(p.teamAssignments)) {
                p.teamAssignments = p.teamAssignments.map((a: any) => ({
                    ...a,
                    type: a.type && typeof a.type === 'object' ? String(a.type.id)
                        : a.type !== undefined && a.type !== null ? String(a.type)
                        : a.team && a.team.type && a.team.type.id ? String(a.team.type.id)
                        : '',
                    startDate: toDateInputValue(a.startDate),
                    endDate: toDateInputValue(a.endDate),
                }));
            }
            setPlayer(p);
        } catch {
            setError('Fehler beim Laden des Spielers.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (openPlayerEditModal) {
            setError(null);
            apiJson('/api/clubs').then(res => setAllClubs(res.entries || [])).catch(() => setAllClubs([]));
            apiJson('/api/teams').then(res => setAllTeams(res.teams || [])).catch(() => setAllTeams([]));
            apiJson('/api/strong-feet').then(res => setAllStrongFeets(res.strongFeets || [])).catch(() => setAllStrongFeets([]));
            apiJson('/api/positions').then(res => setAllPositions(res.positions || [])).catch(() => setAllPositions([]));
            apiJson('/api/player-team-assignment-types').then(res => setAllPlayerTeamAssignmentTypes(res.playerTeamAssignmentTypes || [])).catch(() => setAllPlayerTeamAssignmentTypes([]));
//            apiJson('/api/player-licenses').then(res => setAllLicenses(res.playerLicenses || [])).catch(() => setAllLicenses([]));
            apiJson('/api/nationalities').then(res => setAllNationalities(res.nationalities || [])).catch(() => setAllNationalities([]));
        }
    }, [openPlayerEditModal]);

    useEffect(() => {
        // Beim Öffnen mit playerId=null → Suche einblenden
        if (openPlayerEditModal && !playerId) {
            setShowPlayerSearch(true);
            setPlayerSearchQuery('');
            setPlayerSearchResults([]);
        } else {
            setShowPlayerSearch(false);
        }
    }, [openPlayerEditModal, playerId]);

    useEffect(() => {
        if (openPlayerEditModal && playerId) {
            setLoading(true);
            apiJson(`/api/players/${playerId}`)
                .then(data => {
                    const player = data.player;
                    if (player && Array.isArray(player.teamAssignments)) {
                        player.teamAssignments = player.teamAssignments.map((a: any) => ({
                            ...a,
                            type: a.type && typeof a.type === 'object' ? String(a.type.id)
                                : a.type !== undefined && a.type !== null ? String(a.type)
                                : a.team && a.team.type && a.team.type.id ? String(a.team.type.id)
                                : '',
                            startDate: toDateInputValue(a.startDate),
                            endDate: toDateInputValue(a.endDate),
                        }));
                    }
                    setPlayer(player);
                    setLoading(false);
                })
                .catch(() => {
                    setError('Fehler beim Laden der Trainerdaten.');
                    setLoading(false);
                });
        } else if (openPlayerEditModal) {
            setPlayer(null);
        }
    }, [openPlayerEditModal, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePlayerEditChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setPlayer((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    }, []);

    const handleClubAssignmentChange = useCallback((id: number, field: string, value: any) => {
        setPlayer((prev: any) => {
            const assignments = (prev.clubAssignments || []).map((a: any) =>
                a.id === id ? { ...a, [field]: value } : a
            );
            return { ...prev, clubAssignments: assignments };
        });
    }, []);

    const handleTeamAssignmentChange = useCallback((id: number | null, field: string, value: any) => {
        setPlayer((prev: any) => {
            const assignments = (prev.teamAssignments || []).map((a: any) =>
                a.id === id ? { ...a, [field]: value } : a
            );
            return { ...prev, teamAssignments: assignments };
        });
    }, []);

    const handleAddTeamAssignment = useCallback(() => {
        const tempKey = `new-${Date.now()}-${Math.random()}`;
        setPlayer((prev: any) => {
            const base = prev ?? {};
            return {
                ...base,
                teamAssignments: [
                    ...(base.teamAssignments || []),
                    { id: null, _tempKey: tempKey, team: null, type: '', startDate: undefined, endDate: undefined }
                ]
            };
        });
    }, []);

    const handleRemoveTeamAssignment = useCallback((id: number | null) => {
        setPlayer((prev: any) => {
            const assignments = (prev.teamAssignments || []).filter((a: any) => a.id !== id);
            return { ...prev, teamAssignments: assignments };
        });
    }, []);

    const handleRemoveClubAssignment = useCallback((id: number) => {
        setPlayer((prev: any) => {
            const assignments = (prev.clubAssignments || []).filter((a: any) => a.id !== id);
            return { ...prev, clubAssignments: assignments };
        });
    }, []);

/*
    const handleLicenseAssignmentChange = (id: number, field: string, value: any) => {
        setPlayer((prev: any) => {
            const assignments = (prev.licenseAssignments || []).map((a: any) =>
                a.id === id ? { ...a, [field]: value } : a
            );
            return { ...prev, licenseAssignments: assignments };
        });
    };
    const handleAddLicenseAssignment = () => {
        setPlayer((prev: any) => {
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

    const handleRemoveLicenseAssignment = (id: number) => {
        setPlayer((prev: any) => {
            const assignments = (prev.licenseAssignments || []).filter((a: any) => a.id !== id);
            return { ...prev, licenseAssignments: assignments };
        });
    };
*/

    const handleAddClubAssignment = useCallback(() => {
        setPlayer((prev: any) => {
            const base = prev ?? {};
            return {
                ...base,
                clubAssignments: [
                    ...(base.clubAssignments || []),
                    { id: null, club: null, startDate: undefined, endDate: undefined }
                ]
            };
        });
    }, []);

    const handleNationalityAssignmentChange = useCallback((id: number, field: string, value: any) => {
        setPlayer((prev: any) => {
            const assignments = (prev.nationalityAssignments || []).map((a: any) =>
                a.id === id ? { ...a, [field]: value } : a
            );
            return { ...prev, nationalityAssignments: assignments };
        });
    }, []);

    const handleAddNationalityAssignment = useCallback(() => {
        setPlayer((prev: any) => {
            const base = prev ?? {};
            return {
                ...base,
                nationalityAssignments: [
                    ...(base.nationalityAssignments || []),
                    { id: null, nationality: null, startDate: undefined, endDate: undefined }
                ]
            };
        });
    }, []);
    const handleRemoveNationalityAssignment = useCallback((id: number) => {
        setPlayer((prev: any) => {
            const assignments = (prev.nationalityAssignments || []).filter((a: any) => a.id !== id);
            return { ...prev, nationalityAssignments: assignments };
        });
    }, []);

    const handleOpenNewClubModal = useCallback((assignmentId: number) => {
        setClubModalId(assignmentId);
        setOpenClubModal(true);
    }, []);

    const handleOpenNewNationalityModal = useCallback((assignmentId: number) => {
        setNationalityModalId(assignmentId);
        setOpenNationalityModal(true);
    }, []);

    const canEditStammdaten = player?.permissions?.canEditStammdaten !== false;

    const handlePlayerEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const url = player.id ? `/api/players/${player.id}` : '/api/players';
          const method = player.id ? 'PUT' : 'POST';
          const stammdatenFields = stammdatenRef.current?.getFields() ?? {};
          const res = await apiJson(url, {
            method,
            body: { ...player, ...stammdatenFields },
            headers: { 'Content-Type': 'application/json' },
          });

          if (onPlayerSaved) onPlayerSaved(res.player || res.data || player);
          onPlayerEditModalClose();
        } catch (err: any) {
          setError(err?.message || 'Fehler beim Speichern');
        } finally {
          setLoading(false);
        }
    };

    return (
        <>
            <BaseModal
                open={openPlayerEditModal}
                onClose={onPlayerEditModalClose}
                maxWidth="md"
                title={player?.id ? 'Spieler bearbeiten' : 'Spieler anlegen / zuordnen'}
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

                    {/* Suche nach bestehendem Spieler – nur beim Neuanlegen */}
                    {showPlayerSearch && (
                        <Box
                            sx={{
                                mb: 3,
                                p: 2,
                                bgcolor: 'action.hover',
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'divider'
                            }}>
                            <Typography
                                variant="subtitle1"
                                sx={{
                                    fontWeight: 600,
                                    mb: 1
                                }}>
                                Besteht dieser Spieler bereits?
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: "text.secondary",
                                    mb: 2
                                }}>
                                Suche nach einem vorhandenen Spieler (auch aus früheren Saisons), um eine neue Team-Zuordnung hinzuzufügen, statt einen Duplikat anzulegen.
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 1,
                                    alignItems: "flex-start"
                                }}>
                                <Autocomplete
                                    sx={{ flex: 1 }}
                                    options={playerSearchResults}
                                    getOptionLabel={(option: any) => {
                                        const teams = (option.teamAssignments || [])
                                            .map((a: any) => a.team?.name)
                                            .filter(Boolean)
                                            .join(', ');
                                        const birth = option.birthdate ? ` (Geb.: ${option.birthdate})` : '';
                                        return `${option.firstName} ${option.lastName}${birth}${teams ? ' · ' + teams : ''}`;
                                    }}
                                    filterOptions={(x) => x}
                                    loading={playerSearchLoading}
                                    inputValue={playerSearchQuery}
                                    onInputChange={(_, value) => handlePlayerSearchInput(value)}
                                    onChange={(_, value) => { if (value) handleSelectExistingPlayer(value); }}
                                    noOptionsText={playerSearchQuery.length < 2 ? 'Mind. 2 Zeichen eingeben…' : 'Kein Spieler gefunden'}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Spieler suchen (Name)"
                                            size="small"
                                            slotProps={{
                                                ...params.slotProps,

                                                input: {
                                                    ...(params.slotProps?.input ?? {}),
                                                    endAdornment: (
                                                        <>
                                                            {playerSearchLoading ? <CircularProgress size={16} /> : null}
                                                            {params.slotProps?.input?.endAdornment}
                                                        </>
                                                    ),
                                                }
                                            }}
                                        />
                                    )}
                                    isOptionEqualToValue={(option: any, value: any) => option.id === value.id}
                                />
                                <Button
                                    variant="outlined"
                                    size="small"
                                    sx={{ whiteSpace: 'nowrap', mt: 0.5 }}
                                    onClick={() => { setShowPlayerSearch(false); setPlayer(null); }}
                                >
                                    Neuen Spieler anlegen
                                </Button>
                            </Box>
                        </Box>
                    )}

                    <form id="playerEditForm" autoComplete="off" onSubmit={handlePlayerEditSubmit}>
                        <input type="hidden" name="id" value={player?.id} />
                        <Box className="modal-body" sx={{ bgcolor: 'background.default', p: 0 }}>

                            {/* Hinweis: eingeschränkter Bearbeitungsmodus */}
                            {player?.id && player?.permissions?.canEditStammdaten === false && (
                                <Alert severity="warning" sx={{ mb: 3 }}>
                                    Dieser Spieler gehört auch anderen Teams an. Du kannst nur die Team-Zuordnungen bearbeiten, die deine Teams betreffen. Stammdaten, Verein- und Nationalitäten-Zuordnungen können nur vom zuständigen Verein/Admin geändert werden.
                                </Alert>
                            )}

                            {/* Stammdaten zuerst */}
                            <Box
                                sx={[{
                                    mb: 4,
                                    pb: 2,
                                    borderBottom: 1,
                                    borderColor: "divider"
                                }, !canEditStammdaten ? { opacity: 0.6, pointerEvents: 'none' } : {}]}>
                                <StammdatenSection
                                    ref={stammdatenRef}
                                    initialPlayer={player}
                                    canEdit={canEditStammdaten}
                                    allStrongFeets={allStrongFeets}
                                    allPlayerPositions={allPlayerPositions}
                                />
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
                                    {/* Verein-Zuordnungen: immer sichtbar, nur bearbeitbar bei voller Berechtigung */}
                                    <Box sx={!canEditStammdaten ? { opacity: 0.75 } : {}}>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                mt: 2,
                                                mb: 1
                                            }}>Verein-Zuordnungen</Typography>
                                        {(player?.clubAssignments ?? []).map((assignment: any) => (
                                            <ClubAssignmentRow
                                                key={assignment.id}
                                                assignment={assignment}
                                                canEditStammdaten={canEditStammdaten}
                                                allClubs={allClubs}
                                                onChange={handleClubAssignmentChange}
                                                onRemove={handleRemoveClubAssignment}
                                                onOpenNewClubModal={handleOpenNewClubModal}
                                            />
                                        ))}
                                        {canEditStammdaten && (
                                            <Button onClick={handleAddClubAssignment} startIcon={<AddIcon />} size="small" sx={{ mt: 1 }}>Verein-Zuordnung hinzufügen</Button>
                                        )}
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                mt: 2,
                                                mb: 1
                                            }}>Team-Zuordnungen</Typography>
                                        {(player?.teamAssignments ?? []).map((assignment: any) => (
                                            <TeamAssignmentRow
                                                key={assignment.id ?? assignment._tempKey}
                                                assignment={assignment}
                                                allTeams={allTeams}
                                                allPlayerTeamAssignmentTypes={allPlayerTeamAssignmentTypes}
                                                onChange={handleTeamAssignmentChange}
                                                onRemove={handleRemoveTeamAssignment}
                                            />
                                        ))}
                                        <Button onClick={handleAddTeamAssignment} startIcon={<AddIcon />} size="small" sx={{ mt: 1 }}>Team-Zuordnung hinzufügen</Button>
                                    </Box>
{/*
                                    <Box>
                                        <Typography variant="subtitle1" mt={2} mb={1}>Lizenzen</Typography>
                                        {(player?.licenseAssignments ?? []).map((assignment: any) => (
                                        <Box key={assignment.id} display="flex" gap={2} alignItems="center" mb={1}>
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
                                                InputLabelProps={{ shrink: true }}
                                                sx={{ minWidth: 120 }}
                                                required
                                            />
                                            <TextField
                                                label="Ende"
                                                type="date"
                                                value={assignment.endDate || ''}
                                                onChange={e => handleLicenseAssignmentChange(assignment.id, 'endDate', e.target.value)}
                                                InputLabelProps={{ shrink: true }}
                                                sx={{ minWidth: 120 }}
                                            />
                                            <IconButton onClick={() => handleRemoveLicenseAssignment(assignment.id)} color="error" size="small"><DeleteIcon /></IconButton>
                                        </Box>
                                        ))}
                                        <Button onClick={handleAddLicenseAssignment} startIcon={<AddIcon />} size="small" sx={{ mt: 1 }}>Lizenz hinzufügen</Button>
                                    </Box>
*/}
                                    {/* Nationalitäten: immer sichtbar, nur bearbeitbar bei voller Berechtigung */}
                                    <Box sx={!canEditStammdaten ? { opacity: 0.75 } : {}}>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                mt: 2,
                                                mb: 1
                                            }}>Nationalitäten</Typography>
                                        {(player?.nationalityAssignments ?? []).map((assignment: any) => (
                                            <NationalityAssignmentRow
                                                key={assignment.id}
                                                assignment={assignment}
                                                canEditStammdaten={canEditStammdaten}
                                                allNationalities={allNationalities}
                                                onChange={handleNationalityAssignmentChange}
                                                onRemove={handleRemoveNationalityAssignment}
                                                onOpenNewNationalityModal={handleOpenNewNationalityModal}
                                            />
                                        ))}
                                        {canEditStammdaten && (
                                            <Button onClick={handleAddNationalityAssignment} startIcon={<AddIcon />} size="small" sx={{ mt: 1 }}>
                                                Nationalität hinzufügen
                                            </Button>
                                        )}
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
                            <Button onClick={onPlayerEditModalClose} variant="outlined" color="secondary">
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
                clubId={clubModalId !== null && (player?.clubAssignments ?? []).find((a: any) => a.id === clubModalId)?.club ? (player.clubAssignments ?? []).find((a: any) => a.id === clubModalId).club.id : null}
                onClubSaved={(newClub) => {
                    setAllClubs(prev => [...prev, newClub]);
                    if (clubModalId !== null) {
                        handleClubAssignmentChange(clubModalId, 'club', newClub);
                    }
                    setOpenClubModal(false);
                }}
            />
            {/*
            <PlayerLicenseEditModal
                openPlayerLicenseEditModal={openLicenseModal}
                onPlayerLicenseEditModalClose={() => setOpenLicenseModal(false)}
                playerLicenseId={licenseModalId !== null && (player?.licenseAssignments ?? []).find((a: any) => a.id === licenseModalId)?.license ? (player.licenseAssignments ?? []).find((a: any) => a.id === licenseModalId).license.id : null}
                onPlayerLicenseSaved={(newLicense) => {
                    setAllLicenses(prev => [...prev, newLicense]);
                    if (licenseModalId !== null) {
                        handleLicenseAssignmentChange(licenseModalId, 'license', newLicense);
                    }
                    setOpenLicenseModal(false);
                }}
            />
            */}
            <NationalityEditModal
                openNationalityEditModal={openNationalityModal}
                onNationalityEditModalClose={() => setOpenNationalityModal(false)}
                nationalityId={nationalityModalId !== null && (player?.nationalityAssignments ?? []).find((a: any) => a.id === nationalityModalId)?.nationality ? (player.nationalityAssignments ?? []).find((a: any) => a.id === nationalityModalId).nationality.id : null}
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

export default PlayerEditModal;
