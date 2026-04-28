import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getApiErrorMessage } from '../utils/api';
import {
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  ListSubheader,
  Box,
  Typography,
  Alert,
  Chip,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import ReplayIcon from '@mui/icons-material/Replay';
import {
  fetchGameEventTypes,
  fetchSubstitutionReasons,
  createGameEvent,
  updateGameEvent,
  fetchGameSquad,
  type SquadPlayer,
} from '../services/games';
import { Game, GameEvent, GameEventType, SubstitutionReason } from '../types/games';
import { getGameEventIconByCode } from '../constants/gameEventIcons';
import BaseModal from './BaseModal';
import {
  secondsToMinute,
  minuteToSeconds,
  secondsToFootballTime,
  elapsedSecondsToFormTime,
  formatFootballTime,
  isNearHalfEnd,
  DEFAULT_HALF_DURATION,
} from '../utils/gameEventTime';

// ── Event-Typ Gruppen & Schnellzugriff ───────────────────────────────────────

type EventTypeWithGroup = GameEventType & { group: string; groupOrder: number };

interface LastEventCtx {
  team: string;
  eventType: string;
  player: string;
  relatedPlayer: string;
  label: string;
}

/** Codes die in der Gruppe "★ Häufig genutzt" erscheinen */
const FAVORITE_CODES = new Set([
  'goal', 'own_goal', 'penalty_goal', 'freekick_goal', 'header_goal',
  'assist',
  'yellow_card', 'red_card', 'yellow_red_card',
  'substitution', 'substitution_in', 'substitution_out', 'substitution_injury',
  'foul', 'penalty_foul',
  'shot_on_target', 'corner',
]);

function getGroupInfo(code: string): { group: string; groupOrder: number } {
  if (FAVORITE_CODES.has(code)) return { group: '★ Häufig genutzt', groupOrder: 0 };
  if (/_goal$/.test(code) || code === 'own_goal_attempt') return { group: 'Tore', groupOrder: 1 };
  if (code.includes('_card') || code === 'dangerous_play' ||
      (code.startsWith('foul') && code !== 'foul') ||
      ['handball', 'unsporting', 'obstruct_keeper', 'dive', 'time_wasting',
       'bad_throw_in', 'delay_of_game', 'technical_offense', 'offside'].includes(code))
    return { group: 'Karten & Fouls', groupOrder: 2 };
  if (code.startsWith('substitution') || code === 'sub_goal') return { group: 'Auswechslungen', groupOrder: 3 };
  if (code.startsWith('shot') || ['header_on_target', 'header_off_target', 'volley',
      'bicycle_kick', 'long_shot', 'shot_post', 'shot_bar'].includes(code))
    return { group: 'Schüsse & Kopfbälle', groupOrder: 4 };
  if (code.startsWith('keeper') || code === 'save' || code === 'penalty_save')
    return { group: 'Torhüter', groupOrder: 5 };
  if (code.startsWith('pass') || ['cross', 'chip_ball', 'long_ball', 'switch_play', 'header_pass',
      'throw_in_pass', 'ball_control', 'bad_control', 'first_touch',
      'dribble_success', 'dribble_fail'].includes(code))
    return { group: 'Pässe & Dribbling', groupOrder: 6 };
  if (['ball_win', 'ball_loss_unforced', 'ball_loss_forced'].includes(code))
    return { group: 'Ballgewinn/-verlust', groupOrder: 7 };
  if (code.startsWith('tackle') || code.startsWith('block') || code.startsWith('def_') ||
      ['clearance', 'interception', 'intercept_cross', 'positioning'].includes(code))
    return { group: 'Defensiv', groupOrder: 8 };
  if (code.startsWith('corner') || code.startsWith('freekick') || code.startsWith('penalty') ||
      ['throw_in', 'long_throw_in', 'kickoff', 'goal_kick_2', 'referee_ball', 'backpass_to_keeper'].includes(code))
    return { group: 'Standardsituationen', groupOrder: 9 };
  if (code.startsWith('halftime') || code.startsWith('var') || code.startsWith('match') ||
      ['extra_time', 'injury_break', 'drink_break', 'penalty_shootout',
       'advantage', 'advantage_shown'].includes(code))
    return { group: 'Spielverlauf', groupOrder: 10 };
  return { group: 'Sonstiges', groupOrder: 11 };
}

const GAME_CTX_KEY = (gid: number) => `kb_evt_ctx_${gid}`;
const LAST_EVT_KEY = (gid: number) => `kb_evt_last_${gid}`;

function loadCtx(gid: number): Partial<{ team: string; eventType: string }> {
  try { return JSON.parse(sessionStorage.getItem(GAME_CTX_KEY(gid)) ?? '{}'); } catch { return {}; }
}
function saveCtx(gid: number, ctx: { team: string; eventType: string }) {
  try { sessionStorage.setItem(GAME_CTX_KEY(gid), JSON.stringify(ctx)); } catch { /* noop */ }
}
function loadLastEvent(gid: number): LastEventCtx | null {
  try { return JSON.parse(sessionStorage.getItem(LAST_EVT_KEY(gid)) ?? 'null'); } catch { return null; }
}
function saveLastEvent(gid: number, ev: LastEventCtx) {
  try { sessionStorage.setItem(LAST_EVT_KEY(gid), JSON.stringify(ev)); } catch { /* noop */ }
}

// ── Props ────────────────────────────────────────────────────────────────────

interface GameEventModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  gameId: number;
  game: Game;
  existingEvent?: GameEvent | null;
  /** Sekunden ab Spielstart, vorausgewählt (z.B. vom Video-Klick) */
  initialMinute?: number;
}

// ── Komponente ───────────────────────────────────────────────────────────────

export const GameEventModal: React.FC<GameEventModalProps> = ({
  open,
  onClose,
  onSuccess,
  gameId,
  game,
  existingEvent = null,
  initialMinute,
}) => {
  const halfDuration: number = game.halfDuration ?? game.gameType?.halfDuration ?? DEFAULT_HALF_DURATION;

  const parseExistingSeconds = (): { minute: number; stoppage: number } => {
    let sec = 0;
    if (existingEvent?.timestamp && game.calendarEvent?.startDate) {
      sec = Math.floor(
        (new Date(existingEvent.timestamp).getTime() -
          new Date(game.calendarEvent.startDate).getTime()) / 1000
      );
    } else if (existingEvent?.minute && !isNaN(Number(existingEvent.minute))) {
      sec = Number(existingEvent.minute);
    }
    return secondsToFootballTime(sec, halfDuration);
  };

  const getInitialFormData = () => {
    if (existingEvent) {
      const { minute, stoppage } = parseExistingSeconds();
      return {
        team: existingEvent.team?.id?.toString() || existingEvent.teamId?.toString() || '',
        eventType: existingEvent.gameEventType?.id?.toString() || existingEvent.typeId?.toString() || '',
        player: existingEvent.player?.id?.toString() || existingEvent.playerId?.toString() || '',
        relatedPlayer: existingEvent.relatedPlayer?.id?.toString() || existingEvent.relatedPlayerId?.toString() || '',
        minute: String(minute),
        stoppage: String(stoppage),
        description: existingEvent.description || '',
        reason: (existingEvent as any).reason?.id || 0,
        playerId: existingEvent.playerId || 0,
        teamId: existingEvent.teamId || 0,
      };
    }
    const ctx = loadCtx(gameId);
    return {
      team: ctx.team ?? '',
      eventType: ctx.eventType ?? '',
      player: '',
      relatedPlayer: '',
      minute: initialMinute !== undefined ? String(secondsToMinute(initialMinute)) : '',
      stoppage: '0',
      description: '',
      reason: 0,
      playerId: 0,
      teamId: 0,
    };
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [eventTypes, setEventTypes] = useState<GameEventType[]>([]);
  const [substitutionReasons, setSubstitutionReasons] = useState<SubstitutionReason[]>([]);
  const [formData, setFormData] = useState(getInitialFormData);
  /** Squad (Zugesagte) pro teamId */
  const [squadByTeam, setSquadByTeam] = useState<Record<number, SquadPlayer[]>>({});
  /** Alle aktiven Teamspieler pro teamId */
  const [allPlayersByTeam, setAllPlayersByTeam] = useState<Record<number, SquadPlayer[]>>({});
  const [hasParticipationData, setHasParticipationData] = useState(false);
  const [lastEvent, setLastEvent] = useState<LastEventCtx | null>(null);
  const prevOpen = useRef(false);

  // ── Uhr ───────────────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open && game.calendarEvent?.startDate) {
      const start = new Date(game.calendarEvent.startDate);
      const update = () => {
        setCurrentTime(new Date());
        setElapsedSeconds(Math.floor((Date.now() - start.getTime()) / 1000));
      };
      update();
      timerRef.current = setInterval(update, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    // eslint-disable-next-line
  }, [open, game.calendarEvent?.startDate]);

  // ── Modal-Open ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && !prevOpen.current) {
      setFormData(getInitialFormData());
      setLastEvent(existingEvent ? null : loadLastEvent(gameId));
    }
    prevOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingEvent, initialMinute]);

  useEffect(() => {
    if (open && !existingEvent && typeof initialMinute === 'number') {
      setFormData(prev => ({
        ...prev,
        minute: String(secondsToMinute(initialMinute)),
        stoppage: '0',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMinute, open, existingEvent]);

  // ── Daten laden ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);



  const loadInitialData = async () => {
    try {
      const [eventTypesRaw, reasonsData, squadData] = await Promise.all([
        fetchGameEventTypes(),
        fetchSubstitutionReasons(),
        fetchGameSquad(gameId).catch(() => ({ squad: [], allPlayers: [], hasParticipationData: false })),
      ]);
      const eventTypesData = Array.isArray(eventTypesRaw)
        ? eventTypesRaw
        : ((eventTypesRaw as any).gameEventTypes || []);
      setEventTypes(eventTypesData);
      setSubstitutionReasons(reasonsData);

      // Squad (Zugesagte) nach teamId gruppieren
      const byTeam: Record<number, SquadPlayer[]> = {};
      for (const p of squadData.squad) {
        if (!byTeam[p.teamId]) byTeam[p.teamId] = [];
        byTeam[p.teamId].push(p);
      }
      setSquadByTeam(byTeam);

      // Alle aktiven Spieler nach teamId gruppieren
      const allByTeam: Record<number, SquadPlayer[]> = {};
      for (const p of (squadData.allPlayers ?? [])) {
        if (!allByTeam[p.teamId]) allByTeam[p.teamId] = [];
        allByTeam[p.teamId].push(p);
      }
      setAllPlayersByTeam(allByTeam);
      setHasParticipationData(squadData.hasParticipationData);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  // ── Event-Typ Gruppierung ────────────────────────────────────────────────
  const eventTypesWithGroup: EventTypeWithGroup[] = useMemo(() =>
    [...eventTypes]
      .map(et => ({ ...et, ...getGroupInfo(et.code) }))
      .sort((a, b) => a.groupOrder !== b.groupOrder
        ? a.groupOrder - b.groupOrder
        : a.name.localeCompare(b.name, 'de')),
    [eventTypes]
  );

  const selectedEventType = eventTypesWithGroup.find(et => et.id === Number(formData.eventType)) ?? null;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleInputChange = (field: string, value: string | number) => {
    if (field === 'team') {
      setFormData(prev => ({ ...prev, team: String(value), player: '', relatedPlayer: '' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  /**
   * Gibt gruppierte MenuItems zurück:
   * – "Kader" (zugesagte Spieler, fett + grün)
   * – "Weitere Spieler" (alle aktiven Teamspieler, die nicht im Kader sind)
   */
  const renderPlayerOptions = (selectedTeamId: string | number): React.ReactNode[] => {
    if (!selectedTeamId) return [<MenuItem key="" value="">Spieler wählen…</MenuItem>];
    const teamId = Number(selectedTeamId);
    const squadPlayers = squadByTeam[teamId] ?? [];
    const allForTeam = allPlayersByTeam[teamId] ?? [];
    const squadIds = new Set(squadPlayers.map(p => p.id));
    const nonSquadPlayers = allForTeam.filter(p => !squadIds.has(p.id));

    const items: React.ReactNode[] = [
      <MenuItem key="__empty" value="">Spieler wählen…</MenuItem>,
    ];

    if (squadPlayers.length > 0) {
      items.push(
        <ListSubheader key="__header-kader" sx={{ lineHeight: '32px', fontWeight: 'bold' }}>
          Kader
        </ListSubheader>
      );
      for (const player of squadPlayers) {
        items.push(
          <MenuItem
            key={`squad-${player.id}`}
            value={player.id}
            sx={{ fontWeight: 700, color: 'success.main' }}
          >
            {player.shirtNumber ? `#${player.shirtNumber} ` : ''}{player.fullName}
          </MenuItem>
        );
      }
    }

    if (nonSquadPlayers.length > 0) {
      items.push(
        <ListSubheader key="__header-weitere" sx={{ lineHeight: '32px', fontWeight: 'bold' }}>
          Weitere Spieler
        </ListSubheader>
      );
      for (const player of nonSquadPlayers) {
        items.push(
          <MenuItem key={`all-${player.id}`} value={player.id}>
            {player.shirtNumber ? `#${player.shirtNumber} ` : ''}{player.fullName}
          </MenuItem>
        );
      }
    }

    return items;
  };

  const isSubstitution = () => {
    const et = eventTypes.find(e => e.id === Number(formData.eventType));
    if (!et) return false;
    return et.name.toLowerCase().includes('wechsel') || et.code.toLowerCase().includes('sub');
  };

  /** Setzt Minute auf aktuelle Spielzeit und erkennt Nachspielzeit automatisch */
  const handleSetNow = () => {
    const { minute, stoppage } = elapsedSecondsToFormTime(elapsedSeconds, halfDuration);
    setFormData(prev => ({ ...prev, minute: String(minute), stoppage: String(stoppage) }));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      setLoading(true);
      const sec = minuteToSeconds(
        parseInt(formData.minute, 10) || 0,
        parseInt(formData.stoppage, 10) || 0,
      );
      const submitData = {
        eventType: Number(formData.eventType),
        player: formData.player ? Number(formData.player) : undefined,
        relatedPlayer: formData.relatedPlayer ? Number(formData.relatedPlayer) : undefined,
        minute: String(sec),
        description: formData.description,
        reason: formData.reason ? Number(formData.reason) : undefined,
      };
      if (existingEvent) {
        await updateGameEvent(gameId, existingEvent.id, submitData);
      } else {
        await createGameEvent(gameId, submitData);
        // Kontext für nächstes Event im selben Spiel persistieren
        const savedEt = eventTypes.find(et => et.id === Number(formData.eventType));
        const tId = Number(formData.team);
        const allForTeam = [...(squadByTeam[tId] ?? []), ...(allPlayersByTeam[tId] ?? [])];
        const playerObj = allForTeam.find(p => p.id === Number(formData.player));
        saveCtx(gameId, { team: formData.team, eventType: formData.eventType });
        saveLastEvent(gameId, {
          team: formData.team,
          eventType: formData.eventType,
          player: formData.player,
          relatedPlayer: formData.relatedPlayer,
          label: [savedEt?.name, playerObj?.fullName].filter(Boolean).join(' – '),
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving game event:', error);
      setSubmitError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubmitError(null);
    setFormData({
      team: '', eventType: '', player: '', relatedPlayer: '',
      minute: '', stoppage: '0', description: '', reason: 0, playerId: 0, teamId: 0,
    });
    onClose();
  };

  // ── Anzeige-Berechnungen ───────────────────────────────────────────────────
  const min = parseInt(formData.minute, 10) || 0;
  const stopp = parseInt(formData.stoppage, 10) || 0;
  const timeDisplay = formatFootballTime(min, stopp);
  const isTimeValid = min > 0;
  const showStoppageChips = isNearHalfEnd(min, halfDuration);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <BaseModal
      open={open}
      onClose={handleClose}
      title={existingEvent ? 'Ereignis bearbeiten' : 'Neues Spielereignis'}
      maxWidth="md"
      actions={
        <>
          <Button onClick={handleClose} disabled={loading} variant="outlined" color="secondary"
            sx={{ minHeight: 48 }}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={loading || !formData.eventType || !formData.team || !formData.player || !isTimeValid}
            sx={{ minHeight: 48, flex: 1 }}
          >
            {loading ? 'Speichere…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <Box>
        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        )}

        {/* ── Spielzeit-Block ──────────────────────────────────────────────── */}
        <Box sx={{
          border: '2px solid',
          borderColor: 'primary.main',
          borderRadius: 2,
          p: 1.5,
          mb: 3,
        }}>
          {/* Zeile 1: Jetzt-Button + live Uhr */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Button
              variant="contained"
              color="success"
              onClick={handleSetNow}
              sx={{ flex: 1, minHeight: 48, fontSize: '1rem', fontWeight: 'bold' }}
            >
              <i className="fas fa-clock" style={{ marginRight: 8 }} />
              Jetzt
            </Button>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography variant="body1" fontWeight="bold" sx={{ lineHeight: 1.2, letterSpacing: 1 }}>
                {currentTime.toLocaleTimeString()}
              </Typography>
              {elapsedSeconds > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {Math.floor(elapsedSeconds / 60)} min
                </Typography>
              )}
            </Box>
          </Box>

          {/* Zeile 2: Minuten-Stepper + Vorschau */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              Min.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                const v = Math.max(1, min - 1);
                setFormData(prev => ({ ...prev, minute: String(v), stoppage: '0' }));
              }}
              sx={{ minWidth: 36, px: 0, fontWeight: 'bold', fontSize: '1.1rem' }}
            >
              −
            </Button>
            <TextField
              type="number"
              value={formData.minute}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '');
                setFormData(prev => ({ ...prev, minute: v, stoppage: '0' }));
              }}
              inputProps={{
                min: 1,
                max: 200,
                inputMode: 'numeric',
                style: { textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', padding: '6px 4px' },
              }}
              placeholder="–"
              required
              sx={{ width: 68 }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                const v = Math.min(200, min + 1);
                setFormData(prev => ({ ...prev, minute: String(v), stoppage: '0' }));
              }}
              sx={{ minWidth: 36, px: 0, fontWeight: 'bold', fontSize: '1.1rem' }}
            >
              +
            </Button>
            <Box sx={{ flex: 1 }} />
            <Typography variant="h6" fontWeight="bold" color={isTimeValid ? 'primary.main' : 'text.disabled'} sx={{ flexShrink: 0 }}>
              {isTimeValid ? timeDisplay : '–'}
            </Typography>
          </Box>

          {/* Zeile 3: Nachspielzeit – nur wenn relevant */}
          {showStoppageChips && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mr: 0.25 }}>
                +NSZ
              </Typography>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(n => (
                <Chip
                  key={n}
                  label={`+${n}`}
                  size="small"
                  onClick={() => handleInputChange('stoppage', String(n))}
                  color={stopp === n ? 'primary' : 'default'}
                  variant={stopp === n ? 'filled' : 'outlined'}
                  sx={{ minWidth: 40, fontWeight: 'bold', cursor: 'pointer' }}
                />
              ))}
            </Box>
          )}
        </Box>

        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {game.homeTeam.name} vs {game.awayTeam.name}
        </Typography>

        {/* Letztes Event wiederholen */}
        {!existingEvent && lastEvent && (
          <Button
            variant="outlined"
            size="small"
            fullWidth
            startIcon={<ReplayIcon />}
            onClick={() => setFormData(prev => ({
              ...prev,
              team: lastEvent.team,
              eventType: lastEvent.eventType,
              player: lastEvent.player,
              relatedPlayer: lastEvent.relatedPlayer,
            }))}
            sx={{ mb: 2, justifyContent: 'flex-start', textAlign: 'left', borderColor: 'divider' }}
          >
            Wiederholen: {lastEvent.label}
          </Button>
        )}

        {/* ── Event-Details ─────────────────────────────────────────────────── */}
        <FormControl fullWidth required sx={{ mb: 2 }}>
          <InputLabel>Team</InputLabel>
          <Select
            value={formData.team}
            onChange={e => handleInputChange('team', e.target.value)}
            label="Team"
          >
            <MenuItem value="">Team wählen…</MenuItem>
            <MenuItem value={game.homeTeam.id}>{game.homeTeam.name}</MenuItem>
            <MenuItem value={game.awayTeam.id}>{game.awayTeam.name}</MenuItem>
          </Select>
        </FormControl>

        {/* Event-Typ mit Suche und Gruppierung */}
        <Autocomplete
          options={eventTypesWithGroup}
          groupBy={(option) => option.group}
          getOptionLabel={(option) => option.name}
          value={selectedEventType}
          onChange={(_, value) => handleInputChange('eventType', value ? String(value.id) : '')}
          isOptionEqualToValue={(opt, val) => opt.id === val.id}
          noOptionsText="Kein Event gefunden"
          sx={{ mb: 2 }}
          renderOption={(props, option) => {
            const { key, ...liProps } = props as React.HTMLAttributes<HTMLLIElement> & { key?: React.Key };
            return (
              <li key={key} {...liProps}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: option.color, display: 'flex', alignItems: 'center', minWidth: 20, flexShrink: 0 }}>
                    {getGameEventIconByCode(option.icon ?? '')}
                  </Box>
                  <Typography variant="body2">{option.name}</Typography>
                </Box>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Event-Typ"
              placeholder="Suchen oder tippen…"
              required
            />
          )}
        />

        {/* ── Kader-Indikator: Chip wenn Participation-Daten vorhanden ── */}
        {formData.team && hasParticipationData && (() => {
          const teamId = Number(formData.team);
          const squadCount = squadByTeam[teamId]?.length ?? 0;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Chip
                size="small"
                color={squadCount > 0 ? 'success' : 'default'}
                variant={squadCount > 0 ? 'filled' : 'outlined'}
                label={squadCount > 0 ? `${squadCount} zugesagt` : 'Keine Zusagen'}
                sx={{ fontSize: '0.75rem', cursor: 'default' }}
              />
            </Box>
          );
        })()}

        <FormControl fullWidth required sx={{ mb: 2 }}>
          <InputLabel>Spieler</InputLabel>
          <Select
            value={formData.player}
            onChange={e => handleInputChange('player', e.target.value)}
            label="Spieler"
          >
            {renderPlayerOptions(formData.team)}
          </Select>
        </FormControl>

        {isSubstitution() && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Eingewechselter Spieler</InputLabel>
            <Select
              value={formData.relatedPlayer}
              onChange={e => handleInputChange('relatedPlayer', e.target.value)}
              label="Eingewechselter Spieler"
            >
              {renderPlayerOptions(formData.team)}
            </Select>
          </FormControl>
        )}

        {isSubstitution() && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Grund für Wechsel</InputLabel>
            <Select
              value={formData.reason}
              onChange={e => handleInputChange('reason', e.target.value)}
              label="Grund für Wechsel"
            >
              <MenuItem value="">Grund wählen…</MenuItem>
              {substitutionReasons.map(reason => (
                <MenuItem key={reason.id} value={reason.id}>
                  {reason.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <TextField
          label="Beschreibung (optional)"
          value={formData.description}
          onChange={e => handleInputChange('description', e.target.value)}
          fullWidth
          multiline
          minRows={1}
          sx={{ mb: 1 }}
        />
      </Box>
    </BaseModal>
  );
};
