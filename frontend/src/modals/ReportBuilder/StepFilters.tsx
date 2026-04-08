import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Slider,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Autocomplete,
  TextField,
  CircularProgress,
  Chip,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { ReportBuilderState } from './types';
import { searchReportPlayers, fetchPlayerById } from '../../services/reports';

/** Reusable tooltip info icon */
const Tip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip title={text} placement="top-end">
    <InfoOutlinedIcon fontSize="small" sx={{ mt: 1.75, color: 'text.secondary', flexShrink: 0, cursor: 'default' }} />
  </Tooltip>
);

interface StepFiltersProps {
  state: ReportBuilderState;
}

export const StepFilters: React.FC<StepFiltersProps> = ({ state }) => {
  const {
    currentReport,
    builderData,
    handleFilterChange,
  } = state;

  type PlayerOption = { id: number; fullName: string };

  // ── Player filter — always multi-chip ──
  // Supports both filters.players (comma-sep) and legacy filters.player (single ID).
  const [multiPlayerResolved, setMultiPlayerResolved] = useState<PlayerOption[]>([]);
  const [multiPlayerInput, setMultiPlayerInput] = useState('');
  const [multiPlayerOpts, setMultiPlayerOpts] = useState<PlayerOption[]>([]);
  const [multiPlayerLoading, setMultiPlayerLoading] = useState(false);

  // On mount: resolve existing player IDs from filters.players or fallback to filters.player.
  // Uses functional updater to MERGE with any players already added during async resolution
  // (avoids race condition when StepFilters remounts in MobileWizard mid-fetch).
  useEffect(() => {
    const raw = currentReport.config.filters?.players;
    const single = currentReport.config.filters?.player;
    const source = raw || (single ?? '');
    if (!source) { setMultiPlayerResolved([]); return; }
    const ids = source.split(',').map(Number).filter(Boolean);
    Promise.all(ids.map(id => fetchPlayerById(id))).then(results => {
      const resolved = results.filter((r): r is PlayerOption => r !== null);
      setMultiPlayerResolved(prev => {
        const byId = new Map(prev.map(p => [p.id, p]));
        resolved.forEach(r => { byId.set(r.id, r); }); // merge, not overwrite
        return Array.from(byId.values());
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced player search
  useEffect(() => {
    if (multiPlayerInput.length < 2) { setMultiPlayerOpts([]); return; }
    setMultiPlayerLoading(true);
    const timer = setTimeout(() => {
      searchReportPlayers(multiPlayerInput)
        .then(r => setMultiPlayerOpts(r))
        .catch(() => setMultiPlayerOpts([]))
        .finally(() => setMultiPlayerLoading(false));
    }, 300);
    return () => { clearTimeout(timer); setMultiPlayerLoading(false); };
  }, [multiPlayerInput]);

  const addMultiPlayer = (p: PlayerOption) => {
    if (multiPlayerResolved.some(x => x.id === p.id)) return;
    setMultiPlayerResolved(prev => {
      if (prev.some(x => x.id === p.id)) return prev;
      return [...prev, p];
    });
    // Derive new ID list from filters.players (authoritative state), not from the
    // potentially-stale multiPlayerResolved (which is [] during async init on remount).
    const currentIds = (currentReport.config.filters?.players ?? '')
      .split(',').map(Number).filter(Boolean);
    if (!currentIds.includes(p.id)) {
      handleFilterChange('player', '');
      handleFilterChange('players', [...currentIds, p.id].join(','));
    }
    setMultiPlayerInput(''); setMultiPlayerOpts([]);
  };

  const removeMultiPlayer = (id: number) => {
    setMultiPlayerResolved(prev => prev.filter(x => x.id !== id));
    // Same: derive remaining IDs from filters.players, not from local state.
    const remaining = (currentReport.config.filters?.players ?? '')
      .split(',').map(Number).filter(Boolean)
      .filter(existingId => existingId !== id);
    handleFilterChange('player', '');
    handleFilterChange('players', remaining.length ? remaining.join(',') : '');
  };

  // ── Team filter — always multi-chip ──
  // Supports both filters.teams (comma-sep) and legacy filters.team (single ID).
  const currentTeamIds = (() => {
    const raw = currentReport.config.filters?.teams;
    if (raw) return raw.split(',').map(Number).filter(Boolean);
    const single = currentReport.config.filters?.team;
    return single ? [Number(single)].filter(Boolean) : [];
  })();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {!builderData ? (
        <Typography color="text.secondary">Lade Filterdaten...</Typography>
      ) : (
        <>
          {/* Date range */}
          {builderData.availableDates?.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2">Zeitraum</Typography>
                <Tooltip title="Schränkt die ausgewerteten Ereignisse auf einen bestimmten Datumsbereich ein. Nur Ereignisse innerhalb dieses Zeitraums fließen in den Report ein." placement="top">
                  <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'default' }} />
                </Tooltip>
              </Box>
              <Box display="flex" gap={2} mb={1} flexWrap="wrap">
                <Tooltip title="Startdatum des Zeitfensters aktivieren und einstellen." placement="top">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={currentReport.config.filters?.dateFrom != null}
                        onChange={(e) => handleFilterChange('dateFrom', e.target.checked ? builderData.minDate : null)}
                        size="small"
                      />
                    }
                    label="Von"
                  />
                </Tooltip>
                <Tooltip title="Enddatum des Zeitfensters aktivieren und einstellen." placement="top">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={currentReport.config.filters?.dateTo != null}
                        onChange={(e) => handleFilterChange('dateTo', e.target.checked ? builderData.maxDate : null)}
                        size="small"
                      />
                    }
                    label="Bis"
                  />
                </Tooltip>
              </Box>

              {(currentReport.config.filters?.dateFrom != null || currentReport.config.filters?.dateTo != null) && (
                <Box sx={{ px: 1, mt: 1 }}>
                  <Slider
                    value={[
                      currentReport.config.filters?.dateFrom != null
                        ? builderData.availableDates.indexOf(currentReport.config.filters.dateFrom)
                        : 0,
                      currentReport.config.filters?.dateTo != null
                        ? builderData.availableDates.indexOf(currentReport.config.filters.dateTo)
                        : builderData.availableDates.length - 1,
                    ]}
                    onChange={(_, newValue) => {
                      const [startIndex, endIndex] = newValue as number[];
                      if (currentReport.config.filters?.dateFrom != null) {
                        handleFilterChange('dateFrom', builderData.availableDates[startIndex]);
                      }
                      if (currentReport.config.filters?.dateTo != null) {
                        handleFilterChange('dateTo', builderData.availableDates[endIndex]);
                      }
                    }}
                    min={0}
                    max={builderData.availableDates.length - 1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => builderData.availableDates[value]}
                    marks={[
                      { value: 0, label: builderData.minDate },
                      { value: builderData.availableDates.length - 1, label: builderData.maxDate },
                    ]}
                  />
                </Box>
              )}
            </Paper>
          )}

          {/* Team — immer Multi-Chip (wie GuidedWizard) */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              {currentTeamIds.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                  {currentTeamIds.map(id => {
                    const team = builderData.teams.find(t => t.id === id);
                    return team ? (
                      <Chip key={id} label={team.name} size="small"
                        onDelete={() => {
                          const next = currentTeamIds.filter(n => n !== id);
                          handleFilterChange('team', '');
                          handleFilterChange('teams', next.length ? next.join(',') : '');
                        }}
                      />
                    ) : null;
                  })}
                </Box>
              )}
              <FormControl fullWidth size="small">
                <InputLabel>Team hinzufügen</InputLabel>
                <Select value="" label="Team hinzufügen"
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (!id) return;
                    if (!currentTeamIds.includes(id)) {
                      handleFilterChange('team', '');
                      handleFilterChange('teams', [...currentTeamIds, id].join(','));
                    }
                  }}
                >
                  <MenuItem value="" disabled>Auswählen…</MenuItem>
                  {builderData.teams
                    .filter(t => !currentTeamIds.includes(t.id))
                    .map(t => <MenuItem key={t.id} value={t.id.toString()}>{t.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Tip text="Zeigt nur Ereignisse, die für die gewählten Mannschaften erfasst wurden. Ohne Auswahl werden alle Teams berücksichtigt." />
          </Box>

          {/* Spieler — immer Multi-Chip (wie GuidedWizard) */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              {multiPlayerResolved.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                  {multiPlayerResolved.map(p => (
                    <Chip key={p.id} label={p.fullName} size="small"
                      onDelete={() => removeMultiPlayer(p.id)} />
                  ))}
                </Box>
              )}
              <Autocomplete
                fullWidth
                options={multiPlayerOpts}
                getOptionLabel={(o) => o.fullName}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                value={null}
                inputValue={multiPlayerInput}
                loading={multiPlayerLoading}
                onInputChange={(_, val) => setMultiPlayerInput(val)}
                onChange={(_, v) => { if (v) addMultiPlayer(v); }}
                filterOptions={(x) => x}
                noOptionsText={multiPlayerInput.length < 2 ? 'Mind. 2 Zeichen eingeben' : 'Kein Spieler gefunden'}
                renderInput={(params) => (
                  <TextField {...params} label="Spieler hinzufügen" placeholder="Name eintippen…"
                    slotProps={{ input: { ...params.InputProps,
                      endAdornment: (<>{multiPlayerLoading ? <CircularProgress color="inherit" size={16} /> : null}{params.InputProps.endAdornment}</>)
                    }}}
                  />
                )}
              />
            </Box>
            <Tip text="Filtert auf Ereignisse eines oder mehrerer Spieler. Ohne Auswahl werden alle Spieler berücksichtigt." />
          </Box>

          {/* Spieltyp */}
          {(builderData.gameTypes?.length ?? 0) > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Spieltyp</InputLabel>
                <Select
                  value={currentReport.config.filters?.gameType || ''}
                  onChange={(e) => handleFilterChange('gameType', e.target.value)}
                  label="Spieltyp"
                >
                  <MenuItem value="">Alle Spieltypen</MenuItem>
                  {builderData.gameTypes!.map((gt) => (
                    <MenuItem key={gt.id} value={gt.id.toString()}>{gt.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tip text="Filtert nach der Art des Spiels, z.B. nur Ligaspiele, nur Pokalspiele oder nur Freundschaftsspiele." />
            </Box>
          )}

          {/* Ereignistyp */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Ereignistyp</InputLabel>
              <Select
                value={currentReport.config.filters?.eventType || ''}
                onChange={(e) => handleFilterChange('eventType', e.target.value)}
                label="Ereignistyp"
              >
                <MenuItem value="">Alle Ereignistypen</MenuItem>
                {builderData.eventTypes.map((eventType) => (
                  <MenuItem key={eventType.id} value={eventType.id.toString()}>{eventType.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tip text="Beschränkt den Report auf einen bestimmten Ereignistyp, z.B. nur Tore oder nur Vorlagen. Wird oft mit der Y-Achse kombiniert." />
          </Box>

          {/* Platztyp */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Platztyp</InputLabel>
              <Select
                value={currentReport.config.filters?.surfaceType || ''}
                onChange={(e) => handleFilterChange('surfaceType', e.target.value)}
                label="Platztyp"
              >
                <MenuItem value="">Alle Platztypen</MenuItem>
                {builderData.surfaceTypes?.map((st) => (
                  <MenuItem key={st.id} value={st.id.toString()}>{st.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tip text="Filtert nach der Beschaffenheit des Spielfelds, z.B. nur Ereignisse auf Naturrasen oder nur auf Kunstrasen." />
          </Box>

          {/* Niederschlag */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Wetter (Niederschlag)</InputLabel>
              <Select
                value={currentReport.config.filters?.precipitation || ''}
                onChange={(e) => handleFilterChange('precipitation', e.target.value)}
                label="Wetter (Niederschlag)"
              >
                <MenuItem value="">Beliebig</MenuItem>
                <MenuItem value="yes">Mit Niederschlag</MenuItem>
                <MenuItem value="no">Ohne Niederschlag</MenuItem>
              </Select>
            </FormControl>
            <Tip text="Filtert Ereignisse nach dem Wetter am Spieltag. Erfordert, dass für das Spiel Wetterdaten hinterlegt sind." />
          </Box>
        </>
      )}
    </Box>
  );
};
