import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stepper,
    Step,
    StepLabel,
    Box,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    Autocomplete,
    TextField,
    CircularProgress,
    Alert,
    Chip,
    Stack,
    Paper,
    IconButton,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import { apiJson } from '../utils/api';

interface EntityOption {
    id: number;
    fullName: string;
    teams?: string[];
}

interface RelationType {
    id: number;
    identifier: string;
    name: string;
    category: string; // 'player' or 'coach'
}

interface ContextData {
    relationTypes: RelationType[];
}

interface Props {
    open: boolean;
    onClose: () => void;
}

const STEPS = ['Spieler oder Trainer?', 'Person auswählen', 'Deine Beziehung', 'Bestätigung'];

export default function RegistrationContextDialog({ open, onClose }: Props) {
    const [activeStep, setActiveStep] = useState(0);
    const [entityType, setEntityType] = useState<'player' | 'coach' | null>(null);
    const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null);
    const [selectedRelationType, setSelectedRelationType] = useState<RelationType | null>(null);
    const [note, setNote] = useState('');
    const [contextData, setContextData] = useState<ContextData | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);

    // Search state for Step 1
    const [searchInput, setSearchInput] = useState('');
    const [searchResults, setSearchResults] = useState<EntityOption[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        if (open && !contextData) {
            setLoading(true);
            apiJson('/api/registration-request/context')
                .then((data: any) => {
                    setContextData(data);
                })
                .catch(() => setError('Daten konnten nicht geladen werden.'))
                .finally(() => setLoading(false));
        }
    }, [open, contextData]);

    // Debounced search: fetch after 300 ms when ≥ 2 chars are entered
    useEffect(() => {
        if (!entityType || searchInput.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        const timer = setTimeout(() => {
            apiJson(`/api/registration-request/context/search?type=${entityType}&q=${encodeURIComponent(searchInput.trim())}`)
                .then((data: any) => setSearchResults(data.results ?? []))
                .catch(() => setSearchResults([]))
                .finally(() => setSearchLoading(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [entityType, searchInput]);

    const filteredRelationTypes = contextData?.relationTypes.filter(
        (rt) => rt.category === entityType
    ) ?? [];

    const handleNext = () => {
        setActiveStep((prev) => prev + 1);
        setError('');
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
        setError('');
    };

    const handleEntityTypeChange = (_: React.MouseEvent<HTMLElement>, value: 'player' | 'coach') => {
        if (!value) return;
        setEntityType(value);
        setSelectedEntity(null);
        setSelectedRelationType(null);
        setSearchInput('');
        setSearchResults([]);
    };

    const handleSubmit = async () => {
        if (!entityType || !selectedEntity || !selectedRelationType) return;
        setSubmitting(true);
        setError('');
        try {
            const res = await apiJson('/api/registration-request', {
                method: 'POST',
                body: {
                    entityType,
                    entityId: selectedEntity.id,
                    relationTypeId: selectedRelationType.id,
                    note: note.trim() || null,
                },
            });
            if (res && 'error' in res) {
                setError(res.error);
            } else {
                setSubmitted(true);
            }
        } catch (e: any) {
            setError(e?.message || 'Der Antrag konnte nicht gesendet werden. Bitte versuche es später erneut.');
        } finally {
            setSubmitting(false);
        }
    };

    const canProceedStep0 = !!entityType;
    const canProceedStep1 = !!selectedEntity;
    const canProceedStep2 = !!selectedRelationType;

    const isStepValid = [canProceedStep0, canProceedStep1, canProceedStep2, true];

    const handleReset = () => {
        setActiveStep(0);
        setEntityType(null);
        setSelectedEntity(null);
        setSelectedRelationType(null);
        setNote('');
        setError('');
        setSubmitted(false);
        setSearchInput('');
        setSearchResults([]);
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const entityLabel = entityType === 'player' ? 'Spieler' : 'Trainer';

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ pb: 1, pr: 6 }}>
                Meine Vereinszugehörigkeit angeben
                <IconButton
                    onClick={handleClose}
                    size="small"
                    sx={{ position: 'absolute', top: 10, right: 10 }}
                    aria-label="Schließen"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

                {!loading && submitted && (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                        <CheckCircleOutlineIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
                        <Typography variant="h6" gutterBottom>
                            Antrag eingereicht!
                        </Typography>
                        <Typography color="text.secondary">
                            Ein Administrator wird deinen Antrag prüfen und dich entsprechend zuordnen.
                            Du wirst benachrichtigt, sobald dein Antrag bearbeitet wurde.
                        </Typography>
                    </Box>
                )}

                {!loading && !submitted && (
                    <>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Damit wir wissen, wem wir dich im Verein zuordnen sollen, kannst du hier
                            freiwillig angeben, ob du selbst Spieler/Trainer bist, oder im Verhältnis zu einem stehst.
                            Ein Admin prüft den Antrag noch einmal, bevor er aktiviert wird.
                        </Typography>

                        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
                            {STEPS.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>

                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                        {/* Step 0: Entity type */}
                        {activeStep === 0 && (
                            <Box>
                                <Typography gutterBottom>
                                    Geht es um einen <strong>Spieler</strong> oder einen <strong>Trainer</strong>?
                                </Typography>
                                <ToggleButtonGroup
                                    value={entityType}
                                    exclusive
                                    onChange={handleEntityTypeChange}
                                    fullWidth
                                    sx={{ mt: 1 }}
                                >
                                    <ToggleButton value="player" sx={{ py: 2 }}>
                                        <SportsSoccerIcon sx={{ mr: 1 }} />
                                        Spieler
                                    </ToggleButton>
                                    <ToggleButton value="coach" sx={{ py: 2 }}>
                                        <PersonIcon sx={{ mr: 1 }} />
                                        Trainer
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            </Box>
                        )}

                        {/* Step 1: Person selection */}
                        {activeStep === 1 && (
                            <Box>
                                <Typography gutterBottom>
                                    Gib mindestens 2 Buchstaben ein, um den {entityLabel} zu suchen:
                                </Typography>
                                <Autocomplete
                                    options={searchResults}
                                    getOptionLabel={(o) => o.fullName}
                                    value={selectedEntity}
                                    onChange={(_, val) => setSelectedEntity(val)}
                                    inputValue={searchInput}
                                    onInputChange={(_, val, reason) => {
                                        if (reason !== 'reset') setSearchInput(val);
                                    }}
                                    filterOptions={(x) => x}
                                    loading={searchLoading}
                                    noOptionsText={
                                        searchInput.trim().length < 2
                                            ? 'Bitte mindestens 2 Buchstaben eingeben'
                                            : searchLoading
                                            ? 'Suche...'
                                            : 'Keine Ergebnisse gefunden'
                                    }
                                    renderOption={(props, option) => (
                                        <Box component="li" {...props}>
                                            <Box>
                                                <Typography variant="body2">{option.fullName}</Typography>
                                                {option.teams && option.teams.length > 0 && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {option.teams.join(' · ')}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    )}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={`${entityLabel} suchen`}
                                            variant="outlined"
                                            size="small"
                                            fullWidth
                                            autoFocus
                                            helperText={
                                                selectedEntity
                                                    ? undefined
                                                    : searchInput.trim().length < 2
                                                    ? 'Mindestens 2 Buchstaben eingeben, um die Suche zu starten'
                                                    : undefined
                                            }
                                            InputProps={{
                                                ...params.InputProps,
                                                endAdornment: (
                                                    <>
                                                        {searchLoading ? <CircularProgress color="inherit" size={16} /> : null}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
                                            }}
                                        />
                                    )}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    sx={{ mt: 1 }}
                                />
                            </Box>
                        )}

                        {/* Step 2: Relation type */}
                        {activeStep === 2 && (
                            <Box>
                                <Typography gutterBottom>
                                    In welchem Verhältnis stehst du zu{' '}
                                    <strong>{selectedEntity?.fullName}</strong>?
                                </Typography>
                                <Stack spacing={1} sx={{ mt: 1 }}>
                                    {filteredRelationTypes.map((rt) => (
                                        <Paper
                                            key={rt.id}
                                            variant="outlined"
                                            onClick={() => setSelectedRelationType(rt)}
                                            sx={{
                                                p: 1.5,
                                                cursor: 'pointer',
                                                borderColor: selectedRelationType?.id === rt.id
                                                    ? 'primary.main'
                                                    : 'divider',
                                                bgcolor: selectedRelationType?.id === rt.id
                                                    ? 'primary.50'
                                                    : 'transparent',
                                                '&:hover': { borderColor: 'primary.main' },
                                            }}
                                        >
                                            <Typography variant="body1">{rt.name}</Typography>
                                        </Paper>
                                    ))}
                                </Stack>
                                <TextField
                                    label="Optionale Anmerkung"
                                    multiline
                                    rows={2}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    fullWidth
                                    size="small"
                                    variant="outlined"
                                    sx={{ mt: 2 }}
                                    placeholder="z.B. Ich bin der Vater von Max Mustermann, Team U15"
                                />
                            </Box>
                        )}

                        {/* Step 3: Summary */}
                        {activeStep === 3 && (
                            <Box>
                                <Typography gutterBottom>
                                    Bitte überprüfe deine Angaben:
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
                                    <Stack spacing={1}>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Typography variant="body2" color="text.secondary" sx={{ width: 130 }}>
                                                Typ:
                                            </Typography>
                                            <Chip
                                                size="small"
                                                label={entityType === 'player' ? 'Spieler' : 'Trainer'}
                                                color="primary"
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                            <Typography variant="body2" color="text.secondary" sx={{ width: 130 }}>
                                                Person:
                                            </Typography>
                                            <Typography variant="body2">{selectedEntity?.fullName}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                            <Typography variant="body2" color="text.secondary" sx={{ width: 130 }}>
                                                Meine Beziehung:
                                            </Typography>
                                            <Typography variant="body2">{selectedRelationType?.name}</Typography>
                                        </Box>
                                        {note && (
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Typography variant="body2" color="text.secondary" sx={{ width: 130 }}>
                                                    Anmerkung:
                                                </Typography>
                                                <Typography variant="body2">{note}</Typography>
                                            </Box>
                                        )}
                                    </Stack>
                                </Paper>
                                <Alert severity="info" sx={{ mt: 2 }}>
                                    Dein Antrag wird von einem Administrator überprüft, bevor er aktiv wird.
                                </Alert>
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>

            <DialogActions>
                {submitted ? (
                    <Button onClick={handleClose} variant="contained">
                        Schließen
                    </Button>
                ) : (
                    <>
                        <Button onClick={handleClose} color="inherit">
                            Überspringen
                        </Button>
                        {activeStep > 0 && (
                            <Button onClick={handleBack} disabled={submitting}>
                                Zurück
                            </Button>
                        )}
                        {activeStep < STEPS.length - 1 ? (
                            <Button
                                variant="contained"
                                onClick={handleNext}
                                disabled={!isStepValid[activeStep]}
                            >
                                Weiter
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                onClick={handleSubmit}
                                disabled={submitting}
                                startIcon={submitting ? <CircularProgress size={16} /> : null}
                            >
                                {submitting ? 'Wird gesendet...' : 'Antrag stellen'}
                            </Button>
                        )}
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
