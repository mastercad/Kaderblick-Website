/**
 * useFormationData
 *
 * Verantwortlich für:
 * - Gesamten State des Formation-Editors (Spieler, Bank, Kader, Teams, Formular)
 * - Laden der Teams des Trainers
 * - Laden einer bestehenden Formation zum Bearbeiten
 * - Laden des Squad-Kaders wenn sich das ausgewählte Team ändert
 */
import { useEffect, useState } from 'react';
import { apiJson } from '../../utils/api';
import { normalizeLocalPlayerIds } from './playerIdentity';
import type { Formation, FormationEditorDraft, Player, PlayerData, Team } from './types';

/** Alle State-Werte + Setter, die von den spezialisierten Hooks benötigt werden. */
export interface FormationDataState {
  formation: Formation | null;
  setFormation: React.Dispatch<React.SetStateAction<Formation | null>>;
  currentTemplateCode: string | null;
  setCurrentTemplateCode: React.Dispatch<React.SetStateAction<string | null>>;
  players: PlayerData[];
  setPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  benchPlayers: PlayerData[];
  setBenchPlayers: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  availablePlayers: Player[];
  setAvailablePlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  teams: Team[];
  name: string;
  setName: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  selectedTeam: number | '';
  setSelectedTeam: (v: number | '') => void;
  nextPlayerNumber: number;
  setNextPlayerNumber: React.Dispatch<React.SetStateAction<number>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  showTemplatePicker: boolean;
  setShowTemplatePicker: (v: boolean) => void;
}

/** Mappt einen rohen API-Spieler-Eintrag auf das Player-Interface. */
function mapApiPlayer(e: any): Player {
  return {
    id: e.id,
    name: e.name,
    shirtNumber: e.shirtNumber,
    position: e.position ?? null,
    alternativePositions: Array.isArray(e.alternativePositions) ? e.alternativePositions : [],
  };
}

/**
 * Aktualisiert die Trikotnummer (`number`) aller echten Spieler in einer
 * PlayerData-Liste anhand der aktuellen Kader-Daten (`available`).
 *
 * Nur Einträge mit `isRealPlayer === true` und gesetzter `playerId` werden
 * angefasst; Platzhalter bleiben unverändert.  Falls ein Spieler nicht mehr
 * im Kader ist, bleibt seine gespeicherte Nummer erhalten.
 *
 * @internal Exportiert für Unit-Tests.
 */
export function refreshShirtNumbers(playerList: PlayerData[], available: Player[]): PlayerData[] {
  const shirtByPlayerId = new Map<number, string | number>(
    available
      .filter(p => p.shirtNumber != null)
      .map(p => [p.id, p.shirtNumber!]),
  );
  return playerList.map(p => {
    if (!p.isRealPlayer || p.playerId == null) return p;
    const current = shirtByPlayerId.get(p.playerId);
    return current != null ? { ...p, number: current } : p;
  });
}

export function useFormationData(open: boolean, formationId: number | null, initialDraft?: FormationEditorDraft, initialShowTemplatePicker?: boolean): FormationDataState {
  const [formation, setFormation] = useState<Formation | null>(null);
  const [currentTemplateCode, setCurrentTemplateCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [benchPlayers, setBenchPlayers] = useState<PlayerData[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<number | ''>('');
  const [nextPlayerNumber, setNextPlayerNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const hasDraftPlayers = Boolean(
    initialDraft
    && (
      (initialDraft.formationData?.players?.length ?? 0) > 0
      || (initialDraft.formationData?.bench?.length ?? 0) > 0
    ),
  );

  const resetEditorState = () => {
    setFormation(null);
    setPlayers([]);
    setBenchPlayers([]);
    setAvailablePlayers([]);
    setTeams([]);
    setCurrentTemplateCode(null);
    setName('');
    setNotes('');
    setSelectedTeam('');
    setNextPlayerNumber(1);
    setLoading(false);
    setError(null);
    setSearchQuery('');
    setShowTemplatePicker(false);
  };

  useEffect(() => {
    if (!open) {
      resetEditorState();
    }
  }, [open]);

  // ── Template-Picker für neue Formationen anzeigen ─────────────────────────
  useEffect(() => {
    setShowTemplatePicker(open && !formationId && (Boolean(initialShowTemplatePicker) || !hasDraftPlayers));
  }, [open, formationId, hasDraftPlayers, initialShowTemplatePicker]);

  // ── Teams des Trainers laden ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiJson<{ teams: Team[] }>('/formation/coach-teams')
      .then(data => {
        if (cancelled) return;
        const loaded = Array.isArray(data.teams) ? data.teams : [];
        setTeams(loaded);
        if (loaded.length === 0) {
          setError('Du bist aktuell keinem Team als Trainer zugeordnet. Bitte wende dich an einen Administrator.');
        } else {
          const preferredTeamId = initialDraft?.selectedTeam;
          const hasPreferredTeam = preferredTeamId !== '' && loaded.some(team => team.id === preferredTeamId);
          const nextSelectedTeam: number | '' = hasPreferredTeam && typeof preferredTeamId === 'number'
            ? preferredTeamId
            : (loaded[0]?.id ?? '');
          setSelectedTeam(nextSelectedTeam);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTeams([]);
        setError('Teams konnten nicht geladen werden.');
      });
    return () => { cancelled = true; };
  }, [initialDraft?.selectedTeam, open]);

  // ── Bestehende Formation laden (Bearbeitungsmodus) ────────────────────────
  useEffect(() => {
    if (!open) return;
    if (formationId) {
      let cancelled = false;
      setLoading(true);
      apiJson<any>(`/formation/${formationId}/edit`)
        .then(data => {
          if (cancelled) return;
          const f = data.formation;
          setFormation(f);
          setCurrentTemplateCode(typeof f.formationData?.code === 'string' ? f.formationData.code : null);
          setName(f.name);

          const usedIds = new Set<number>();
          const fieldPlayers: PlayerData[] = Array.isArray(f.formationData?.players)
            ? normalizeLocalPlayerIds(f.formationData.players.map((p: any) => ({ ...p })), usedIds)
            : [];
          const bench: PlayerData[] = Array.isArray(f.formationData?.bench)
            ? normalizeLocalPlayerIds(f.formationData.bench.map((p: any) => ({ ...p })), usedIds)
            : [];

          setPlayers(fieldPlayers);
          setBenchPlayers(bench);
          setNotes(f.formationData?.notes ?? '');

          const allNums = [...fieldPlayers, ...bench].map(p =>
            typeof p.number === 'number' ? p.number : 0,
          );
          setNextPlayerNumber(allNums.length > 0 ? Math.max(...allNums) + 1 : 1);

          if (Array.isArray(data.availablePlayers?.players)) {
            const available = data.availablePlayers.players.map((e: any) =>
              mapApiPlayer({ ...e.player, shirtNumber: e.shirtNumber, position: e.position, alternativePositions: e.alternativePositions }),
            );
            setAvailablePlayers(available);
            // Trikotnummern auf dem Feld und der Bank sofort auf den Stand
            // des aktuellen PlayerTeamAssignments bringen (überschreibt ggf.
            // veraltete oder sequenzielle Nummern aus dem gespeicherten JSON).
            setPlayers(prev => refreshShirtNumbers(prev, available));
            setBenchPlayers(prev => refreshShirtNumbers(prev, available));
          }
        })
        .catch(err => { if (!cancelled) setError(err?.message ?? 'Fehler beim Laden'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    } else {
      // Zurücksetzen für neue Formation
      setFormation(null);
      setCurrentTemplateCode(typeof initialDraft?.formationData?.code === 'string' ? initialDraft.formationData.code : null);
      const usedIds = new Set<number>();
      const draftPlayers: PlayerData[] = Array.isArray(initialDraft?.formationData?.players)
        ? normalizeLocalPlayerIds(initialDraft!.formationData.players.map(player => ({ ...player })), usedIds)
        : [];
      const draftBench: PlayerData[] = Array.isArray(initialDraft?.formationData?.bench)
        ? normalizeLocalPlayerIds(initialDraft!.formationData.bench.map(player => ({ ...player })), usedIds)
        : [];

      setName(initialDraft?.name ?? '');
      setNotes(initialDraft?.formationData?.notes ?? '');
      setPlayers(draftPlayers);
      setBenchPlayers(draftBench);
      const allNums = [...draftPlayers, ...draftBench].map(player =>
        typeof player.number === 'number' ? player.number : parseInt(String(player.number), 10) || 0,
      );
      setNextPlayerNumber(allNums.length > 0 ? Math.max(...allNums) + 1 : 1);
      setAvailablePlayers([]);
      setSearchQuery('');
      setError(null);
    }
  }, [formationId, initialDraft, open]);

  // ── Kader laden wenn Team gewechselt wird ─────────────────────────────────
  useEffect(() => {
    if (!open || !selectedTeam) {
      if (!selectedTeam) setAvailablePlayers([]);
      return;
    }
    let cancelled = false;
    apiJson<any>(`/formation/team/${selectedTeam}/players`)
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data.players)) {
          const mapped = data.players
            .filter((e: any) => e?.id)
            .map(mapApiPlayer);
          setAvailablePlayers(mapped);
          // Bereits auf dem Feld oder der Bank befindliche echte Spieler
          // erhalten die Trikotnummer des neu gewählten Teams.
          setPlayers(prev => refreshShirtNumbers(prev, mapped));
          setBenchPlayers(prev => refreshShirtNumbers(prev, mapped));
          setError(mapped.length === 0 ? 'Keine Spieler für dieses Team gefunden.' : null);
        } else {
          setAvailablePlayers([]);
        }
      })
      .catch(() => { if (!cancelled) setAvailablePlayers([]); });
    return () => { cancelled = true; };
  }, [open, selectedTeam]);

  return {
    formation, setFormation,
    currentTemplateCode, setCurrentTemplateCode,
    players, setPlayers,
    benchPlayers, setBenchPlayers,
    availablePlayers, setAvailablePlayers,
    teams,
    name, setName,
    notes, setNotes,
    selectedTeam,
    setSelectedTeam: setSelectedTeam as (v: number | '') => void,
    nextPlayerNumber, setNextPlayerNumber,
    loading, setLoading,
    error, setError,
    searchQuery, setSearchQuery,
    showTemplatePicker, setShowTemplatePicker,
  };
}
