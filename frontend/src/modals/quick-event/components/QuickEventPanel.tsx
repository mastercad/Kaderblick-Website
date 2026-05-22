import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Game, GameEventType } from '../../../types/games';
import { MatchPlanPlayer } from '../../../types/games';
import { QuickEventConfig } from '../types';
import { QuickEventEventStep } from './QuickEventEventStep';
import { QuickEventPlayerStep } from './QuickEventPlayerStep';
import { QuickEventSubFlow } from './QuickEventSubFlow';
import { useActiveSquad } from '../useActiveSquad';
import { createGameEvent, deleteGameEvent, fetchGameEventTypes, fetchGameSquad, SquadPlayer } from '../../../services/games';
import { useToast } from '../../../context/ToastContext';
import {
  elapsedSecondsToFormTime,
  minuteToSeconds,
} from '../../../utils/gameEventTime';

/**
 * Modul-Level-Cache: überlebt Unmount/Remount des Panels.
 * Verhindert Race-Condition bei schneller Interaktion direkt nach dem Öffnen.
 */
let _cachedEventTypes: GameEventType[] = [];

/** Codes, die den Wechsel-Flow (RAUS → REIN) auslösen. */
const SUBSTITUTION_CODES = new Set([
  'substitution',
  'substitution_in',
  'substitution_out',
  'substitution_injury',
]);

type Step = 'event' | 'player' | 'sub';

interface QuickEventPanelProps {
  open: boolean;
  onClose: () => void;
  game: Game;
  gameId: number;
  config: QuickEventConfig;
  /** Team-ID des aktiven Filters (selectedTeamId aus der Spielübersicht). Nur Spieler dieses Teams werden angezeigt. */
  filterTeamId?: number | 'all';
  /** Wird nach erfolgreichem Speichern aufgerufen (z.B. Ereignisliste neu laden). */
  onEventCreated: () => void;
}

/**
 * Hauptkomponente der Fernbedienung.
 * Schritt 1: Event-Typ wählen (QuickEventEventStep).
 * Schritt 2a: Spieler wählen (QuickEventPlayerStep) oder
 * Schritt 2b: Wechsel-Flow (QuickEventSubFlow).
 */
export const QuickEventPanel: React.FC<QuickEventPanelProps> = ({
  open,
  onClose,
  game,
  gameId,
  config,
  filterTeamId,
  onEventCreated,
}) => {
  const { showToast } = useToast();
  const { onField: mpOnField, bench: mpBench, hasMatchPlan } = useActiveSquad(game);

  // Fallback-Spielerliste wenn kein MatchPlan vorhanden
  const [fallbackPlayers, setFallbackPlayers] = useState<MatchPlanPlayer[]>([]);

  const onField = hasMatchPlan ? mpOnField : fallbackPlayers;
  const bench = hasMatchPlan ? mpBench : fallbackPlayers;

  const [step, setStep] = useState<Step>('event');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  /**
   * Synchrone Referenz auf den gewählten Event-Code.
   * Wird von handlePlayerSelect/handleSkipPlayer/handleSubComplete gelesen
   * und SOFORT beim Auslösen auf null gesetzt — verhindert Stale-Closure-Bugs
   * und Doppelauslösungen bei schnellen Interaktionen.
   */
  const selectedCodeRef = useRef<string | null>(null);

  const [eventTypes, setEventTypes] = useState<GameEventType[]>(_cachedEventTypes);
  /** Lifted state: wer beim Wechsel rausgeht (damit der Banner sticky im Header bleibt). */
  const [playerOut, setPlayerOut] = useState<MatchPlanPlayer | null>(null);
  /** Undo-Info: nach erfolgreichem Speichern für kurze Zeit sichtbar. */
  const [undoInfo, setUndoInfo] = useState<{ eventId: number; gameId: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Guard: verhindert doppelte API-Aufrufe wenn useEffect mehrfach feuert. */
  const isFetchingEventTypesRef = useRef(false);
  const isFetchingSquadRef = useRef(false);
  /** Merkt ob das Panel über den Back-Button geschlossen wurde (kein extra history.back() nötig). */
  const closedViaPopstateRef = useRef(false);

  // State-Reset wenn das Panel geschlossen wird (defensiver Guard)
  useEffect(() => {
    console.log('[QuickEventPanel] open geändert:', open, new Error('open-change-trace').stack?.split('\n').slice(1, 4).join(' | '));
    if (!open) {
      selectedCodeRef.current = null;
      setStep('event');
      setSelectedCode(null);
      setPlayerOut(null);
      setUndoInfo(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      // Guards zurücksetzen damit beim nächsten Öffnen neu geladen wird
      isFetchingSquadRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Hardware-Back-Button (Android / Browser-Zurück) schließt das Panel statt die Seite zu verlassen
  useEffect(() => {
    if (!open) {
      // Panel wurde programmatisch geschlossen (nicht via Back) → Dummy-Eintrag entfernen
      if (!closedViaPopstateRef.current && window.history.state?.quickEventPanel) {
        console.log('[QuickEventPanel] open=false → history.back() wird aufgerufen, state:', window.history.state);
        window.history.back();
      }
      closedViaPopstateRef.current = false;
      return;
    }
    closedViaPopstateRef.current = false;
    console.log('[QuickEventPanel] open=true → pushState quickEventPanel');
    window.history.pushState({ quickEventPanel: true }, '');
    const handlePopState = (e: PopStateEvent) => {
      console.log('[QuickEventPanel] popstate gefeuert → onClose() wird aufgerufen, state:', e.state);
      closedViaPopstateRef.current = true;
      onClose();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      // Kein history.back() hier! In React Strict Mode würde das den frisch
      // registrierten Listener triggern und onClose() unerwünscht aufrufen.
      window.removeEventListener('popstate', handlePopState);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Spielzeit-Timer (identisch zu GameEventModal)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const halfDuration: number = game.halfDuration ?? game.gameType?.halfDuration ?? 45;

  useEffect(() => {
    if (open && game.calendarEvent?.startDate) {
      const start = new Date(game.calendarEvent.startDate);
      const update = () =>
        setElapsedSeconds(Math.floor((Date.now() - start.getTime()) / 1000));
      update();
      timerRef.current = setInterval(update, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [open, game.calendarEvent?.startDate]);

  // Fallback-Spieler laden wenn kein MatchPlan vorhanden
  useEffect(() => {
    if (!open || hasMatchPlan || isFetchingSquadRef.current) return;
    isFetchingSquadRef.current = true;
    fetchGameSquad(gameId)
      .then((data) => {
        // Team-Filter: filterTeamId hat Vorrang, Fallback auf game.userTeamIds
        const resolvedTeamId = typeof filterTeamId === 'number' ? filterTeamId : null;
        const userTeamIds = resolvedTeamId
          ? new Set<number>([resolvedTeamId])
          : new Set<number>(game.userTeamIds ?? []);
        const allCandidates: SquadPlayer[] =
          data.squad.length > 0 ? data.squad : data.allPlayers;
        // Nur Spieler des eigenen Teams anzeigen
        const source = userTeamIds.size > 0
          ? allCandidates.filter((p) => userTeamIds.has(p.teamId))
          : allCandidates;
        setFallbackPlayers(
          source.map((p) => ({
            id: p.id,
            playerId: p.id,
            name: p.fullName,
            number: p.shirtNumber ?? '',
            x: 0,
            y: 0,
          }))
        );
      })
      .catch(() => {
        // kein Spieler-Fallback — Panel bleibt offen, Spielerliste leer
      })
      .finally(() => { isFetchingSquadRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gameId, hasMatchPlan]);

  // Event-Typen beim ersten Öffnen laden
  useEffect(() => {
    if (!open || eventTypes.length > 0 || isFetchingEventTypesRef.current) return;
    isFetchingEventTypesRef.current = true;
    fetchGameEventTypes()
      .then((raw) => {
        const list: GameEventType[] = Array.isArray(raw)
          ? raw
          : (raw as any).gameEventTypes ?? [];
        _cachedEventTypes = list;
        setEventTypes(list);
      })
      .catch(() => {
        showToast('Event-Typen konnten nicht geladen werden', 'error');
      })
      .finally(() => { isFetchingEventTypesRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetToEventStep = () => {
    selectedCodeRef.current = null;
    setStep('event');
    setSelectedCode(null);
    setPlayerOut(null);
  };

  const handleClose = (source: string) => {
    console.log('[QuickEventPanel] handleClose() source:', source, '\nStack:', new Error().stack?.split('\n').slice(1, 6).join(' | '));
    resetToEventStep();
    onClose();
  };

  /** Liefert die aktuelle Spielminute als Sekunden-String für die API. */
  const currentMinuteString = useCallback((): string => {
    const { minute, stoppage } = elapsedSecondsToFormTime(elapsedSeconds, halfDuration);
    return String(minuteToSeconds(minute, stoppage));
  }, [elapsedSeconds, halfDuration]);

  /** Sucht die Event-Type-ID für einen Code. */
  const resolveEventTypeId = (code: string): number | null => {
    const found = eventTypes.find((et) => et.code === code);
    return found?.id ?? null;
  };

  const saveEvent = (params: {
    eventTypeCode: string;
    playerId?: number;
    relatedPlayerId?: number;
  }) => {
    const eventTypeId = resolveEventTypeId(params.eventTypeCode);
    if (!eventTypeId) {
      showToast(`Unbekannter Event-Typ: ${params.eventTypeCode}`, 'error');
      return;
    }

    // Sofort zurück zur Event-Übersicht — API-Call läuft im Hintergrund
    const minute = currentMinuteString();
    console.log('[QuickEventPanel] saveEvent fire-and-forget gestartet, code:', params.eventTypeCode);
    resetToEventStep();

    createGameEvent(gameId, {
      eventType: eventTypeId,
      player: params.playerId,
      relatedPlayer: params.relatedPlayerId,
      minute,
    }).then((result) => {
      console.log('[QuickEventPanel] createGameEvent erfolgreich, rufe onEventCreated()');
      onEventCreated();
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (result.eventId) {
        setUndoInfo({ eventId: result.eventId, gameId });
        undoTimerRef.current = setTimeout(() => setUndoInfo(null), 8000);
      }
    }).catch(() => {
      showToast('Fehler beim Speichern — bitte nochmals versuchen', 'error');
    });
  };

  const handleEventSelect = (code: string) => {
    selectedCodeRef.current = code;
    setSelectedCode(code);
    setPlayerOut(null); // Reset damit nie ein alter Spieler vorbelegt ist
    if (SUBSTITUTION_CODES.has(code)) {
      setStep('sub');
    } else {
      setStep('player');
    }
  };

  const handlePlayerSelect = (player: MatchPlanPlayer) => {
    const code = selectedCodeRef.current;
    if (!code) return;
    selectedCodeRef.current = null; // sofort nullen — verhindert Doppelauslösung
    saveEvent({ eventTypeCode: code, playerId: player.playerId ?? player.id });
  };

  const handleSkipPlayer = () => {
    const code = selectedCodeRef.current;
    if (!code) return;
    selectedCodeRef.current = null; // sofort nullen — verhindert Doppelauslösung
    saveEvent({ eventTypeCode: code });
  };

  const handleSubComplete = (playerOutId: number, playerInId: number) => {
    const code = selectedCodeRef.current;
    if (!code) return;
    selectedCodeRef.current = null; // sofort nullen — verhindert Doppelauslösung
    saveEvent({
      eventTypeCode: code,
      playerId: playerOutId,
      relatedPlayerId: playerInId,
    });
  };

  const handleUndo = async () => {
    if (!undoInfo) return;
    const info = undoInfo;
    setUndoInfo(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    try {
      await deleteGameEvent(info.gameId, info.eventId);
      onEventCreated();
      showToast('Rückgängig gemacht', 'success');
    } catch {
      showToast('Rückgängig fehlgeschlagen', 'error');
    }
  };

  const stepTitle = step === 'event' ? 'QUICK EVENTS' : step === 'sub' ? 'AUSWECHSLUNG' : 'SPIELER WÄHLEN';

  const minuteDisplay = elapsedSeconds > 0
    ? `${Math.floor(elapsedSeconds / 60)}'`
    : null;

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        console.log('[QuickEventPanel] Dialog onClose, reason:', reason);
        if (reason === 'backdropClick') return;
        handleClose('Dialog-onClose reason=' + reason);
      }}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#0d0d0d',
            overflow: 'hidden',
            // Verhindert Text-Selektion bei Long-Press auf dem gesamten Panel
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'pan-y',
          },
        }
      }}
    >
      {/* Zentrierter Content-Wrapper für Desktop */}
      <Box
        sx={{
          maxWidth: 480,
          mx: 'auto',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#0d0d0d',
        }}
      >
      {/* ─── Header ─────────────────────────── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.75,
          bgcolor: '#161616',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {step !== 'event' && (
            <IconButton
              size="small"
              onClick={resetToEventStep}
              sx={{
                color: 'rgba(255,255,255,0.5)',
                mr: 0.5,
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Typography
            variant="overline"
            sx={{
              fontWeight: 800,
              fontSize: '0.75rem',
              letterSpacing: '0.12em',
              color: '#fff',
              lineHeight: 1,
            }}
          >
            {stepTitle}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {minuteDisplay && (
            <Box
              sx={{
                px: 1.25,
                py: 0.4,
                bgcolor: 'rgba(255,59,48,0.18)',
                border: '1px solid rgba(255,59,48,0.35)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: '#ff3b30',
                  animation: 'blink 1.2s ease-in-out infinite',
                  '@keyframes blink': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.25 },
                  },
                }}
              />
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: '#ff6b63',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.04em',
                }}
              >
                {minuteDisplay}
              </Typography>
            </Box>
          )}
          <IconButton
            size="small"
            onClick={() => handleClose('X-Button')}
            sx={{
              color: 'rgba(255,255,255,0.45)',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* ─── Kontext-Banner (sticky, scrollt nie weg) ─── */}
      {step === 'sub' && (
        <Box
          sx={{
            flexShrink: 0,
            px: 2.5,
            py: 1.5,
            bgcolor: playerOut ? 'rgba(20,6,6,0.95)' : 'rgba(10,18,10,0.95)',
            borderBottom: playerOut
              ? '2px solid rgba(255,59,48,0.35)'
              : '2px solid rgba(74,222,128,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {playerOut ? (
            <>
              <Box
                sx={{
                  px: 1.25,
                  py: 0.4,
                  bgcolor: 'rgba(255,59,48,0.22)',
                  border: '1px solid rgba(255,59,48,0.5)',
                  borderRadius: '6px',
                }}
              >
                <Typography
                  sx={{ fontSize: '0.7rem', fontWeight: 900, color: '#ff6b63', letterSpacing: '0.12em' }}
                >
                  RAUS
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff', lineHeight: 1.2 }}>
                #{playerOut.number} {playerOut.name}
              </Typography>
              <Box sx={{ ml: 'auto' }}>
                <Box
                  sx={{
                    px: 1.25,
                    py: 0.4,
                    bgcolor: 'rgba(74,222,128,0.15)',
                    border: '1px solid rgba(74,222,128,0.4)',
                    borderRadius: '6px',
                  }}
                >
                  <Typography
                    sx={{ fontSize: '0.7rem', fontWeight: 900, color: '#4ade80', letterSpacing: '0.1em' }}
                  >
                    REIN WÄHLEN ↓
                  </Typography>
                </Box>
              </Box>
            </>
          ) : (
            <>
              <Box
                sx={{
                  px: 1.25,
                  py: 0.4,
                  bgcolor: 'rgba(255,59,48,0.15)',
                  border: '1px solid rgba(255,59,48,0.35)',
                  borderRadius: '6px',
                }}
              >
                <Typography
                  sx={{ fontSize: '0.7rem', fontWeight: 900, color: '#ff6b63', letterSpacing: '0.12em' }}
                >
                  RAUS
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)' }}>
                Wer verlässt das Feld?
              </Typography>
            </>
          )}
        </Box>
      )}

      {/* ─── Content ────────────────────────────────────── */}
      <DialogContent
        sx={{ px: 2.5, pt: 2.5, pb: 3, bgcolor: '#0d0d0d', overflowY: 'auto', position: 'relative' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {step === 'event' ? (
          <QuickEventEventStep buttons={config.buttons} gameEventTypes={eventTypes} onSelect={handleEventSelect} />
        ) : step === 'sub' ? (
          <QuickEventSubFlow
            onField={onField}
            bench={bench}
            playerOut={playerOut}
            onSelectPlayerOut={setPlayerOut}
            onComplete={handleSubComplete}
            onCancel={() => resetToEventStep()}
          />
        ) : (
          <QuickEventPlayerStep
            players={onField}
            title="Welcher Spieler?"
            onSelectPlayer={handlePlayerSelect}
            onSkip={handleSkipPlayer}
          />
        )}


      </DialogContent>

      {/* ─── Undo-Leiste (unten, temporär nach Speichern) ─── */}
      {undoInfo && (
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            py: 1.25,
            bgcolor: 'rgba(10,28,10,0.97)',
            borderTop: '1px solid rgba(74,222,128,0.3)',
          }}
        >
          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.02em' }}>
            Ereignis gespeichert
          </Typography>
          <Button
            size="small"
            onClick={handleUndo}
            sx={{
              color: '#4ade80',
              fontWeight: 800,
              fontSize: '0.8rem',
              letterSpacing: '0.06em',
              px: 1.5,
              py: 0.5,
              minWidth: 0,
              textTransform: 'uppercase',
              '&:hover': { bgcolor: 'rgba(74,222,128,0.12)' },
            }}
          >
            Rückgängig
          </Button>
        </Box>
      )}
      </Box>
    </Dialog>
  );
};
