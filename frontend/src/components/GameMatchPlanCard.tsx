import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AddCircleOutline as AddCircleOutlineIcon,
  CheckCircle as CheckCircleIcon,
  DeleteOutline as DeleteOutlineIcon,
  Edit as EditIcon,
  FileOpen as FileOpenIcon,
  LockOpen as LockOpenIcon,
  Visibility as VisibilityIcon,
  SportsSoccer as SportsSoccerIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import FormationEditModal from '../modals/FormationEditModal';
import type { Formation, FormationEditorDraft } from '../modals/formation/types';
import { getZoneColor } from '../modals/formation/helpers';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchGameSquad,
  saveGameMatchPlan,
} from '../services/games';
import type {
  Game,
  MatchPlan,
  MatchPlanPhase,
  MatchPlanPlayer,
} from '../types/games';
import { apiJson, getApiErrorMessage } from '../utils/api';

interface GameMatchPlanCardProps {
  game: Game;
  onUpdated?: () => Promise<void> | void;
}

interface PhaseDialogState {
  open: boolean;
  basePhaseId: string | null;
  minute: string;
  label: string;
}

interface PortfolioImportDialogState {
  open: boolean;
  formationId: number | '';
}

interface ClearStartDialogState {
  open: boolean;
}

interface PreviewDialogState {
  open: boolean;
  phaseId: string | null;
}

interface SquadOptionRow {
  id: number;
  fullName: string;
  shirtNumber: number | null;
  teamId: number;
}

interface EditorState {
  open: boolean;
  mode: 'phase' | 'portfolio';
  title: string;
  saveButtonLabel: string;
  formationId: number | null;
  phaseId: string | null;
  draft?: FormationEditorDraft;
  initialShowTemplatePicker?: boolean;
  pendingPhase?: MatchPlanPhase;
}

interface PhaseAnalysis {
  kind: 'unchanged' | 'shape_change' | 'substitution' | 'mixed';
  substitution: {
    playerOutId: number | null;
    playerOutName?: string;
    playerInId: number | null;
    playerInName?: string;
    note?: string | null;
    reasonId?: number | null;
  } | null;
  summary: string;
}

const createPhaseId = () => `phase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const clonePlayers = (players: MatchPlanPlayer[]): MatchPlanPlayer[] => players.map(player => ({
  ...player,
  position: player.position ?? undefined,
  alternativePositions: [...(player.alternativePositions ?? [])],
}));

const toEditorPlayers = (players: MatchPlanPlayer[]) => players.map(player => ({
  ...player,
  position: player.position ?? undefined,
  alternativePositions: [...(player.alternativePositions ?? [])],
}));

const fromFormationPlayers = (players: unknown): MatchPlanPlayer[] => {
  if (!Array.isArray(players)) return [];

  return players.map((player, index) => {
    const row = player as Partial<MatchPlanPlayer>;
    return {
      id: typeof row.id === 'number' ? row.id : Date.now() + index,
      x: typeof row.x === 'number' ? row.x : 50,
      y: typeof row.y === 'number' ? row.y : 50,
      number: row.number ?? index + 1,
      name: row.name ?? `Spieler ${index + 1}`,
      playerId: typeof row.playerId === 'number' ? row.playerId : null,
      isRealPlayer: Boolean(row.isRealPlayer ?? row.playerId),
      position: row.position ?? undefined,
      alternativePositions: Array.isArray(row.alternativePositions) ? [...row.alternativePositions] : [],
    };
  });
};

const createEmptyStartPhase = (): MatchPlanPhase => ({
  id: createPhaseId(),
  minute: 0,
  label: 'Start',
  sourceType: 'start',
  templateCode: null,
  players: [],
  bench: [],
  substitution: null,
  confirmedEventId: null,
  confirmedAt: null,
});

const sortPhases = (phases: MatchPlanPhase[]): MatchPlanPhase[] => [...phases].sort((left, right) => left.minute - right.minute);

const normalizeMatchPlan = (plan: MatchPlan | null | undefined, defaultTeamId: number | null): MatchPlan => {
  const rawPhases = Array.isArray(plan?.phases) ? plan.phases : [];
  const phases = rawPhases.length > 0
    ? sortPhases(rawPhases.map((phase, index) => ({
        id: phase.id || createPhaseId(),
        minute: typeof phase.minute === 'number' ? phase.minute : index === 0 ? 0 : index * 15 * 60,
        label: phase.label || (index === 0 ? 'Start' : `Phase ${index + 1}`),
        sourceType: phase.sourceType ?? (index === 0 ? 'start' : 'shape_change'),
        templateCode: typeof phase.templateCode === 'string' ? phase.templateCode : null,
        players: clonePlayers(phase.players ?? []),
        bench: clonePlayers(phase.bench ?? []),
        substitution: phase.substitution ? { ...phase.substitution } : null,
        confirmedEventId: phase.confirmedEventId ?? null,
        confirmedAt: phase.confirmedAt ?? null,
      })))
    : [createEmptyStartPhase()];

  phases[0] = {
    ...phases[0],
    minute: 0,
    label: 'Start',
    sourceType: 'start',
  };

  return {
    selectedTeamId: plan?.selectedTeamId ?? defaultTeamId,
    sourceFormationId: plan?.sourceFormationId ?? null,
    published: Boolean(plan?.published),
    publishedAt: plan?.published ? (plan?.publishedAt ?? null) : null,
    phases,
    updatedAt: plan?.updatedAt,
  };
};

const formatMatchMinute = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs === 0 ? `${mins}'` : `${mins}:${String(secs).padStart(2, '0')}`;
};

const buildPhaseDraft = (phase: MatchPlanPhase, teamId: number | null): FormationEditorDraft => ({
  name: phase.minute === 0 ? 'Startformation' : phase.label,
  selectedTeam: teamId ?? '',
  formationData: {
    code: phase.templateCode ?? undefined,
    players: toEditorPlayers(phase.players),
    bench: toEditorPlayers(phase.bench),
    notes: phase.substitution?.note ?? '',
  },
});

const createPlayerLookup = (rows: SquadOptionRow[]) => new Map(rows.map(row => [row.id, row]));

const setsEqual = (left: Set<number>, right: Set<number>) => {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
};

const POSITION_CHANGE_THRESHOLD = 0.5;
const POSITION_SWAP_THRESHOLD = 3;

const getPlayerName = (
  playerId: number | null | undefined,
  lookup: Map<number, SquadOptionRow>,
  player?: MatchPlanPlayer,
  fallback?: string,
) => {
  if (playerId != null) {
    const knownName = lookup.get(playerId)?.fullName;
    if (knownName) return knownName;
  }

  if (player?.name?.trim()) return player.name.trim();
  if (fallback?.trim()) return fallback.trim();
  if (player?.number != null && String(player.number).trim()) return `#${String(player.number).trim()}`;
  return 'Spieler';
};

const getDistance = (left: MatchPlanPlayer, right: MatchPlanPlayer) => Math.hypot(left.x - right.x, left.y - right.y);

const hasRelevantMovement = (previous: MatchPlanPlayer, next: MatchPlanPlayer) => (
  Math.abs(previous.x - next.x) > POSITION_CHANGE_THRESHOLD || Math.abs(previous.y - next.y) > POSITION_CHANGE_THRESHOLD
);

const getHorizontalZoneLabel = (x: number) => {
  if (x < 22) return 'links';
  if (x < 42) return 'halblinks';
  if (x <= 58) return 'zentral';
  if (x <= 78) return 'halbrechts';
  return 'rechts';
};

const getVerticalZoneLabel = (y: number) => {
  if (y < 18) return 'tief';
  if (y < 38) return 'defensiv';
  if (y <= 62) return 'zentral';
  if (y <= 82) return 'offensiv';
  return 'hoch';
};

const formatFieldZone = (player: MatchPlanPlayer) => `${getVerticalZoneLabel(player.y)} ${getHorizontalZoneLabel(player.x)}`;

const formatCompactList = (items: string[]) => {
  if (items.length === 0) return '';
  return items.join('; ');
};

const getRealPlayersById = (phase: MatchPlanPhase) => new Map(
  phase.players
    .filter(player => player.isRealPlayer && player.playerId != null)
    .map(player => [player.playerId as number, player]),
);

interface MovedPlayerAnalysis {
  playerId: number;
  playerName: string;
  previousPlayer: MatchPlanPlayer;
  nextPlayer: MatchPlanPlayer;
}

const collectMovedPlayers = (
  previousByPlayerId: Map<number, MatchPlanPlayer>,
  nextByPlayerId: Map<number, MatchPlanPlayer>,
  playerLookup: Map<number, SquadOptionRow>,
) => [...nextByPlayerId.entries()]
  .map(([playerId, nextPlayer]) => {
    const previousPlayer = previousByPlayerId.get(playerId);
    if (!previousPlayer || !hasRelevantMovement(previousPlayer, nextPlayer)) return null;

    return {
      playerId,
      playerName: getPlayerName(playerId, playerLookup, nextPlayer, previousPlayer.name),
      previousPlayer,
      nextPlayer,
    } satisfies MovedPlayerAnalysis;
  })
  .filter((entry): entry is MovedPlayerAnalysis => Boolean(entry));

const findSwapPartner = (
  current: MovedPlayerAnalysis,
  movedPlayers: MovedPlayerAnalysis[],
  handledPlayerIds: Set<number>,
) => movedPlayers.find(candidate => (
  candidate.playerId !== current.playerId
  && !handledPlayerIds.has(candidate.playerId)
  && getDistance(current.nextPlayer, candidate.previousPlayer) <= POSITION_SWAP_THRESHOLD
  && getDistance(candidate.nextPlayer, current.previousPlayer) <= POSITION_SWAP_THRESHOLD
));

const mapIncomingToOutgoingPlayers = (outgoing: MatchPlanPlayer[], incoming: MatchPlanPlayer[]) => {
  const remainingOutgoing = [...outgoing];

  return incoming.map(inPlayer => {
    if (remainingOutgoing.length === 0) {
      return { inPlayer, outPlayer: null as MatchPlanPlayer | null };
    }

    let bestIndex = 0;
    let bestDistance = getDistance(remainingOutgoing[0], inPlayer);

    for (let index = 1; index < remainingOutgoing.length; index += 1) {
      const distance = getDistance(remainingOutgoing[index], inPlayer);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    const [outPlayer] = remainingOutgoing.splice(bestIndex, 1);
    return { inPlayer, outPlayer };
  });
};

const describeSubstitutionChanges = (
  previousPhase: MatchPlanPhase,
  nextPhase: MatchPlanPhase,
  playerLookup: Map<number, SquadOptionRow>,
  playerOutIds: number[],
  playerInIds: number[],
) => {
  const previousByPlayerId = new Map(
    previousPhase.players
      .filter(player => player.isRealPlayer && player.playerId != null)
      .map(player => [player.playerId as number, player]),
  );
  const nextByPlayerId = new Map(
    nextPhase.players
      .filter(player => player.isRealPlayer && player.playerId != null)
      .map(player => [player.playerId as number, player]),
  );

  const outgoingPlayers = playerOutIds
    .map(playerId => previousByPlayerId.get(playerId))
    .filter((player): player is MatchPlanPlayer => Boolean(player));
  const incomingPlayers = playerInIds
    .map(playerId => nextByPlayerId.get(playerId))
    .filter((player): player is MatchPlanPlayer => Boolean(player));

  if (outgoingPlayers.length > 0 && outgoingPlayers.length === incomingPlayers.length) {
    return formatCompactList(
      mapIncomingToOutgoingPlayers(outgoingPlayers, incomingPlayers).map(({ inPlayer, outPlayer }) => {
        const outName = getPlayerName(outPlayer?.playerId, playerLookup, outPlayer ?? undefined, nextPhase.substitution?.playerOutName);
        const inName = getPlayerName(inPlayer.playerId, playerLookup, inPlayer, nextPhase.substitution?.playerInName);
        return `${outName} raus, ${inName} rein`;
      }),
    );
  }

  const details: string[] = [];

  if (playerOutIds.length > 0) {
    details.push(`Raus: ${formatCompactList(playerOutIds.map(playerId => getPlayerName(playerId, playerLookup, previousByPlayerId.get(playerId))))}`);
  }

  if (playerInIds.length > 0) {
    details.push(`Rein: ${formatCompactList(playerInIds.map(playerId => getPlayerName(playerId, playerLookup, nextByPlayerId.get(playerId))))}`);
  }

  return details.join(' | ');
};

const describePositionChanges = (
  previousPhase: MatchPlanPhase,
  nextPhase: MatchPlanPhase,
  playerLookup: Map<number, SquadOptionRow>,
  initialHandledPlayerIds?: Set<number>,
) => {
  const previousByPlayerId = getRealPlayersById(previousPhase);
  const nextByPlayerId = getRealPlayersById(nextPhase);
  const movedPlayers = collectMovedPlayers(previousByPlayerId, nextByPlayerId, playerLookup);

  if (movedPlayers.length === 0) return '';

  const handledPlayerIds = new Set(initialHandledPlayerIds ?? []);
  const swapDescriptions: string[] = [];
  const moveDescriptions: string[] = [];

  for (const current of movedPlayers) {
    if (handledPlayerIds.has(current.playerId)) continue;

    const swapPartner = findSwapPartner(current, movedPlayers, handledPlayerIds);

    if (swapPartner) {
      handledPlayerIds.add(current.playerId);
      handledPlayerIds.add(swapPartner.playerId);
      swapDescriptions.push(`${current.playerName} tauscht mit ${swapPartner.playerName}`);
      continue;
    }

    handledPlayerIds.add(current.playerId);
    moveDescriptions.push(`${current.playerName}: ${formatFieldZone(current.previousPlayer)} -> ${formatFieldZone(current.nextPlayer)}`);
  }

  const sections: string[] = [];

  if (swapDescriptions.length > 0) {
    sections.push(`Positionswechsel: ${formatCompactList(swapDescriptions)}`);
  }

  if (moveDescriptions.length > 0) {
    sections.push(`Verschoben: ${formatCompactList(moveDescriptions)}`);
  }

  return sections.join(' | ');
};

const analyzePhaseChange = (
  previousPhase: MatchPlanPhase,
  nextPhase: MatchPlanPhase,
  playerLookup: Map<number, SquadOptionRow>,
): PhaseAnalysis => {
  const previousIds = new Set(previousPhase.players.filter(player => player.isRealPlayer && player.playerId != null).map(player => player.playerId as number));
  const currentIds = new Set(nextPhase.players.filter(player => player.isRealPlayer && player.playerId != null).map(player => player.playerId as number));
  const playerOutIds = [...previousIds].filter(id => !currentIds.has(id));
  const playerInIds = [...currentIds].filter(id => !previousIds.has(id));
  const substitutionSummary = describeSubstitutionChanges(previousPhase, nextPhase, playerLookup, playerOutIds, playerInIds);
  const previousByPlayerId = getRealPlayersById(previousPhase);
  const nextByPlayerId = getRealPlayersById(nextPhase);
  const movedPlayers = collectMovedPlayers(previousByPlayerId, nextByPlayerId, playerLookup);
  const handledMovementPlayerIds = new Set<number>();
  let positionSummary = '';

  if (playerOutIds.length === 1 && playerInIds.length === 1) {
    const playerOutId = playerOutIds[0];
    const playerInId = playerInIds[0];
    const outPlayer = previousByPlayerId.get(playerOutId) ?? null;
    const inPlayer = nextByPlayerId.get(playerInId) ?? null;
    const substitution = {
      playerOutId,
      playerOutName: playerLookup.get(playerOutId)?.fullName ?? nextPhase.substitution?.playerOutName ?? 'Spieler raus',
      playerInId,
      playerInName: playerLookup.get(playerInId)?.fullName ?? nextPhase.substitution?.playerInName ?? 'Spieler rein',
      note: nextPhase.substitution?.note ?? null,
      reasonId: nextPhase.substitution?.reasonId ?? null,
    };

    const linkedSwap = outPlayer && inPlayer
      ? movedPlayers.find(candidate => (
          getDistance(inPlayer, candidate.previousPlayer) <= POSITION_SWAP_THRESHOLD
          && getDistance(candidate.nextPlayer, outPlayer) <= POSITION_SWAP_THRESHOLD
        ))
      : null;

    if (linkedSwap && inPlayer) {
      handledMovementPlayerIds.add(linkedSwap.playerId);
    }

    positionSummary = describePositionChanges(previousPhase, nextPhase, playerLookup, handledMovementPlayerIds);

    const linkedSubstitutionSummary = linkedSwap && inPlayer
      ? `${substitution.playerOutName ?? 'Spieler raus'} raus, ${substitution.playerInName ?? 'Spieler rein'} rein und tauscht danach mit ${linkedSwap.playerName} die Position (${substitution.playerInName ?? 'Spieler rein'} jetzt ${formatFieldZone(inPlayer)}, ${linkedSwap.playerName} jetzt ${formatFieldZone(linkedSwap.nextPlayer)})`
      : null;

    const finalSubstitutionSummary = linkedSubstitutionSummary
      ?? substitutionSummary
      ?? `${playerLookup.get(playerOutId)?.fullName ?? 'Spieler raus'} raus, ${playerLookup.get(playerInId)?.fullName ?? 'Spieler rein'} rein.`;

    return {
      kind: linkedSubstitutionSummary || positionSummary ? 'mixed' : 'substitution',
      substitution,
      summary: [
        finalSubstitutionSummary,
        positionSummary,
      ].filter(Boolean).join(' | '),
    };
  }

  positionSummary = describePositionChanges(previousPhase, nextPhase, playerLookup);

  if (setsEqual(previousIds, currentIds)) {
    if (positionSummary) {
      return {
        kind: 'shape_change',
        substitution: null,
        summary: positionSummary,
      };
    }

    return {
      kind: 'unchanged',
      substitution: null,
      summary: 'Keine Änderung zur vorherigen Formation.',
    };
  }

  return {
    kind: 'mixed',
    substitution: null,
    summary: [substitutionSummary, positionSummary].filter(Boolean).join(' | ') || 'Mehrere Änderungen.',
  };
};

const getDefaultPhaseDialogState = (baseMinute: number, basePhaseId: string | null): PhaseDialogState => ({
  open: false,
  basePhaseId,
  minute: String(Math.max(1, Math.floor(baseMinute / 60) + 15)),
  label: '',
});

const createPortfolioDraftName = (game: Game, phase: MatchPlanPhase) => {
  const baseName = `${game.homeTeam.name} vs. ${game.awayTeam.name}`;
  return phase.minute === 0 ? `${baseName} Startformation` : `${baseName} ${formatMatchMinute(phase.minute)}`;
};

const FormationPreview = ({
  players,
  size = 'compact',
  onClick,
}: {
  players: MatchPlanPlayer[];
  size?: 'compact' | 'large';
  onClick?: () => void;
}) => (
  <Box
    onClick={onClick}
    sx={{
      width: size === 'large' ? '100%' : { xs: '100%', sm: 188 },
      maxWidth: size === 'large' ? 560 : { xs: 280, sm: 188 },
      aspectRatio: '1357 / 960',
      backgroundImage: 'url(/images/formation/fussballfeld_haelfte.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      bgcolor: '#2a5c27',
      borderRadius: 2.5,
      border: '1px solid',
      borderColor: 'divider',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
      mx: { xs: 'auto', sm: 0 },
      cursor: onClick ? 'pointer' : 'default',
    }}
  >
    {players.slice(0, 11).map(player => (
      <Box
        key={player.id}
        sx={{
          position: 'absolute',
          left: `${player.x}%`,
          top: `${player.y}%`,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: size === 'large' ? 56 : 42,
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            width: size === 'large' ? { xs: 24, sm: 28 } : { xs: 18, sm: 15 },
            height: size === 'large' ? { xs: 24, sm: 28 } : { xs: 18, sm: 15 },
            borderRadius: '50%',
            bgcolor: getZoneColor(player.y),
            color: 'common.white',
            fontSize: size === 'large' ? { xs: '0.7rem', sm: '0.82rem' } : { xs: '0.54rem', sm: '0.45rem' },
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.85)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
            lineHeight: 1,
          }}
        >
          {String(player.number).slice(0, 2)}
        </Box>
        <Box
          sx={{
            mt: size === 'large' ? 0.5 : 0.35,
            px: size === 'large' ? 0.75 : 0.55,
            py: 0.15,
            maxWidth: size === 'large' ? 92 : 64,
            borderRadius: 1,
            bgcolor: 'rgba(7, 12, 18, 0.78)',
            color: 'rgba(255,255,255,0.94)',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
            fontSize: size === 'large' ? { xs: '0.5rem', sm: '0.6rem' } : { xs: '0.42rem', sm: '0.36rem' },
            fontWeight: 700,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'center',
          }}
        >
          {player.name}
        </Box>
      </Box>
    ))}
  </Box>
);

const renderPublishedStatus = (matchPlan: MatchPlan) => {
  if (!matchPlan.published) {
    return {
      label: 'Nicht freigegeben',
      color: 'default' as const,
      hint: 'Spieler sehen diesen Plan aktuell nicht.',
    };
  }

  return {
    label: 'Freigegeben',
    color: 'success' as const,
    hint: matchPlan.publishedAt
      ? `Seit ${new Date(matchPlan.publishedAt).toLocaleString('de-DE')} sichtbar.`
      : 'Für Spieler des gewählten Teams sichtbar.',
  };
};

const inferSelectedTeamId = (
  plan: MatchPlan,
  rows: SquadOptionRow[],
  availableTeamIds: number[],
  fallbackTeamId: number | null,
) => {
  const explicitTeamId = plan.selectedTeamId ?? null;
  const validTeamIds = new Set(availableTeamIds);
  const rowLookup = createPlayerLookup(rows);
  const counts = new Map<number, number>();

  for (const phase of plan.phases) {
    for (const player of [...phase.players, ...phase.bench]) {
      if (!player.isRealPlayer || player.playerId == null) continue;

      const teamId = rowLookup.get(player.playerId)?.teamId;
      if (!teamId || !validTeamIds.has(teamId)) continue;
      counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
    }
  }

  const rankedTeams = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  if (rankedTeams.length > 0) {
    const [topTeamId, topCount] = rankedTeams[0];
    const hasTie = rankedTeams.some(([teamId, count], index) => index > 0 && count === topCount && teamId !== topTeamId);
    if (!hasTie) {
      return topTeamId;
    }
  }

  if (explicitTeamId && validTeamIds.has(explicitTeamId)) {
    return explicitTeamId;
  }

  return fallbackTeamId;
};

const getAnalysisChipProps = (analysis: PhaseAnalysis) => {
  switch (analysis.kind) {
    case 'substitution':
      return { label: 'Wechsel', color: 'warning' as const, icon: <SwapHorizIcon /> };
    case 'shape_change':
      return { label: 'Umstellung', color: 'info' as const, icon: <SportsSoccerIcon /> };
    case 'mixed':
      return { label: 'Mehrfachänderung', color: 'secondary' as const, icon: <SportsSoccerIcon /> };
    default:
      return { label: 'Ohne Änderung', color: 'default' as const, icon: <SportsSoccerIcon /> };
  }
};

export default function GameMatchPlanCard({ game, onUpdated }: GameMatchPlanCardProps) {
  const theme = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const teamOptions = useMemo(() => [game.homeTeam, game.awayTeam].filter(Boolean), [game.awayTeam, game.homeTeam]);
  const defaultTeamId = useMemo(() => {
    const explicitSelectedTeamId = game.matchPlan?.selectedTeamId ?? null;
    if (explicitSelectedTeamId && teamOptions.some(team => team.id === explicitSelectedTeamId)) {
      return explicitSelectedTeamId;
    }

    const matchingUserTeam = teamOptions.find(team => (game.userTeamIds ?? []).includes(team.id));
    return matchingUserTeam?.id ?? teamOptions[0]?.id ?? null;
  }, [game.matchPlan?.selectedTeamId, game.userTeamIds, teamOptions]);
  const isCoachOrAdmin = Boolean(
    user?.isCoach
    || Object.values(user?.roles ?? {}).includes('ROLE_ADMIN')
    || Object.values(user?.roles ?? {}).includes('ROLE_SUPERADMIN')
  );
  const canManageMatchPlan = isCoachOrAdmin && Boolean(game.permissions?.can_manage_match_plan);
  const canPublishMatchPlan = isCoachOrAdmin && Boolean(game.permissions?.can_publish_match_plan ?? canManageMatchPlan);
  const canViewMatchPlan = canManageMatchPlan || Boolean(game.permissions?.can_view_match_plan);

  const [matchPlan, setMatchPlan] = useState<MatchPlan>(() => normalizeMatchPlan(game.matchPlan, defaultTeamId));
  const [selectedFormationId, setSelectedFormationId] = useState<number | ''>('');
  const [formations, setFormations] = useState<Formation[]>([]);
  const [allPlayersRows, setAllPlayersRows] = useState<SquadOptionRow[]>([]);
  const [hasParticipationData, setHasParticipationData] = useState(false);
  const [phaseDialog, setPhaseDialog] = useState<PhaseDialogState>(() => getDefaultPhaseDialogState(0, null));
  const [portfolioDialog, setPortfolioDialog] = useState<PortfolioImportDialogState>({ open: false, formationId: '' });
  const [clearStartDialog, setClearStartDialog] = useState<ClearStartDialogState>({ open: false });
  const [editorState, setEditorState] = useState<EditorState>({
    open: false,
    mode: 'phase',
    title: '',
    saveButtonLabel: 'Speichern',
    formationId: null,
    phaseId: null,
  });
  const [loadingResources, setLoadingResources] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewDialog, setPreviewDialog] = useState<PreviewDialogState>({ open: false, phaseId: null });

  useEffect(() => {
    if (!canViewMatchPlan && !canManageMatchPlan) {
      setMatchPlan(normalizeMatchPlan(null, defaultTeamId));
      return;
    }

    const normalized = normalizeMatchPlan(game.matchPlan, defaultTeamId);
    setMatchPlan(normalized);
    setSelectedFormationId(normalized.sourceFormationId ?? '');
  }, [canManageMatchPlan, canViewMatchPlan, defaultTeamId, game.id, game.matchPlan]);

  useEffect(() => {
    if (!canViewMatchPlan && !canManageMatchPlan) {
      setAllPlayersRows([]);
      setHasParticipationData(false);
      setFormations([]);
      return;
    }

    let cancelled = false;
    setLoadingResources(true);

    const formationRequest = canManageMatchPlan
      ? apiJson<{ formations: Formation[] }>('/formations')
      : Promise.resolve({ formations: [] as Formation[] });

    Promise.all([
      fetchGameSquad(game.id),
      formationRequest,
    ])
      .then(([squadResponse, formationsResponse]) => {
        if (cancelled) return;
        setAllPlayersRows(Array.isArray(squadResponse.allPlayers) ? squadResponse.allPlayers : []);
        setHasParticipationData(Boolean(squadResponse.hasParticipationData));
        setFormations(Array.isArray(formationsResponse.formations) ? formationsResponse.formations : []);
      })
      .catch(error => {
        if (cancelled) return;
        showToast(getApiErrorMessage(error), 'error');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingResources(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManageMatchPlan, canViewMatchPlan, game.id, showToast]);

  const sortedPhases = useMemo(() => sortPhases(matchPlan.phases), [matchPlan.phases]);
  const startPhase = sortedPhases[0] ?? createEmptyStartPhase();
  const gamePhases = sortedPhases.slice(1);
  const playerLookup = useMemo(() => createPlayerLookup(allPlayersRows), [allPlayersRows]);
  const selectedTeamId = useMemo(
    () => inferSelectedTeamId(matchPlan, allPlayersRows, teamOptions.map(team => team.id), defaultTeamId),
    [allPlayersRows, defaultTeamId, matchPlan, teamOptions],
  );
  const phaseAnalyses = useMemo(() => {
    const result = new Map<string, PhaseAnalysis>();
    for (let index = 1; index < sortedPhases.length; index += 1) {
      result.set(sortedPhases[index].id, analyzePhaseChange(sortedPhases[index - 1], sortedPhases[index], playerLookup));
    }
    return result;
  }, [playerLookup, sortedPhases]);
  const previewPhase = useMemo(() => sortedPhases.find(phase => phase.id === previewDialog.phaseId) ?? null, [previewDialog.phaseId, sortedPhases]);
  const previewAnalysis = useMemo(() => {
    if (!previewPhase || previewPhase.minute === 0) return null;
    return phaseAnalyses.get(previewPhase.id) ?? null;
  }, [phaseAnalyses, previewPhase]);
  const publicationStatus = useMemo(() => renderPublishedStatus(matchPlan), [matchPlan]);

  const prepareMatchPlanForSave = useCallback((plan: MatchPlan) => {
    const preparedPhases: MatchPlanPhase[] = [];
    const phases = sortPhases(plan.phases);

    for (const [index, phase] of phases.entries()) {
      const normalizedPhase: MatchPlanPhase = {
        ...phase,
        label: phase.minute === 0 ? 'Start' : (phase.label.trim() || 'Spielformation'),
        players: clonePlayers(phase.players),
        bench: clonePlayers(phase.bench),
        substitution: phase.substitution ? { ...phase.substitution } : null,
      };

      if (index === 0) {
        normalizedPhase.minute = 0;
        normalizedPhase.sourceType = 'start';
        normalizedPhase.label = 'Start';
        normalizedPhase.substitution = null;
        preparedPhases.push(normalizedPhase);
        continue;
      }

      if (normalizedPhase.minute <= preparedPhases[index - 1].minute) {
        return { error: `Die Spielformation "${normalizedPhase.label}" muss nach der vorherigen Formation liegen.` };
      }

      const analysis = analyzePhaseChange(preparedPhases[index - 1], normalizedPhase, playerLookup);
      if (analysis.substitution) {
        normalizedPhase.sourceType = 'substitution';
        normalizedPhase.substitution = analysis.substitution;
      } else {
        normalizedPhase.sourceType = 'shape_change';
        normalizedPhase.substitution = null;
        normalizedPhase.confirmedEventId = null;
        normalizedPhase.confirmedAt = null;
      }

      preparedPhases.push(normalizedPhase);
    }

    return {
      plan: {
        ...plan,
        selectedTeamId,
        sourceFormationId: selectedFormationId || null,
        published: Boolean(plan.published),
        publishedAt: plan.published ? (plan.publishedAt ?? new Date().toISOString()) : null,
        phases: preparedPhases,
        updatedAt: new Date().toISOString(),
      } satisfies MatchPlan,
    };
  }, [playerLookup, selectedFormationId, selectedTeamId]);

  const persistMatchPlan = useCallback(async (planOverride?: MatchPlan, successMessage = 'Spiel-Formationen gespeichert.') => {
    const candidatePlan = planOverride ?? matchPlan;
    const prepared = prepareMatchPlanForSave(candidatePlan);
    if (!prepared.plan) {
      showToast(prepared.error ?? 'Spiel-Formationen konnten nicht gespeichert werden.', 'error');
      return null;
    }

    setSaving(true);
    try {
      const response = await saveGameMatchPlan(game.id, prepared.plan);
      const normalized = normalizeMatchPlan(response.matchPlan, defaultTeamId);
      setMatchPlan(normalized);
      setSelectedFormationId(normalized.sourceFormationId ?? '');
      showToast(successMessage, 'success');
      await onUpdated?.();
      return normalized;
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }, [defaultTeamId, game.id, matchPlan, onUpdated, prepareMatchPlanForSave, showToast]);

  const openPhaseEditor = useCallback((phase: MatchPlanPhase) => {
    setEditorState({
      open: true,
      mode: 'phase',
      title: phase.minute === 0 ? 'Startformation bearbeiten' : `${formatMatchMinute(phase.minute)} bearbeiten`,
      saveButtonLabel: 'Für dieses Spiel übernehmen',
      formationId: null,
      phaseId: phase.id,
      draft: buildPhaseDraft(phase, selectedTeamId),
      initialShowTemplatePicker: false,
      pendingPhase: undefined,
    });
  }, [selectedTeamId]);

  const openPhaseTemplatePicker = useCallback((phase: MatchPlanPhase) => {
    setEditorState({
      open: true,
      mode: 'phase',
      title: phase.minute === 0 ? 'Startformation aus Vorlage aufbauen' : `${formatMatchMinute(phase.minute)} aus Vorlage aufbauen`,
      saveButtonLabel: 'Für dieses Spiel übernehmen',
      formationId: null,
      phaseId: phase.id,
      draft: buildPhaseDraft(phase, selectedTeamId),
      initialShowTemplatePicker: true,
      pendingPhase: undefined,
    });
  }, [selectedTeamId]);

  const openPhaseAsPortfolio = useCallback((phase: MatchPlanPhase) => {
    setEditorState({
      open: true,
      mode: 'portfolio',
      title: 'Als Portfolio-Aufstellung speichern',
      saveButtonLabel: 'Ins Portfolio speichern',
      formationId: null,
      phaseId: null,
      draft: {
        ...buildPhaseDraft(phase, selectedTeamId),
        name: createPortfolioDraftName(game, phase),
      },
      initialShowTemplatePicker: false,
      pendingPhase: undefined,
    });
  }, [game, selectedTeamId]);

  const handlePhaseDraftSave = useCallback(async (draft: FormationEditorDraft) => {
    if (!editorState.phaseId && !editorState.pendingPhase) return;

    if (editorState.pendingPhase) {
      const createdPhase: MatchPlanPhase = {
        ...editorState.pendingPhase,
        label: editorState.pendingPhase.minute === 0 ? 'Start' : (draft.name.trim() || editorState.pendingPhase.label),
        templateCode: typeof draft.formationData.code === 'string' ? draft.formationData.code : null,
        players: fromFormationPlayers(draft.formationData.players),
        bench: fromFormationPlayers(draft.formationData.bench),
        substitution: null,
      };

      const nextPlan: MatchPlan = {
        ...matchPlan,
        selectedTeamId: draft.selectedTeam === '' ? matchPlan.selectedTeamId : draft.selectedTeam,
        phases: sortPhases([...matchPlan.phases, createdPhase]),
      };

      setMatchPlan(nextPlan);
      await persistMatchPlan(nextPlan, 'Spielformation gespeichert.');
      return;
    }

    const updatedPlan: MatchPlan = {
      ...matchPlan,
      selectedTeamId: draft.selectedTeam === '' ? matchPlan.selectedTeamId : draft.selectedTeam,
      phases: matchPlan.phases.map(phase => {
        if (phase.id !== editorState.phaseId) return phase;
        return {
          ...phase,
          label: phase.minute === 0 ? 'Start' : (draft.name.trim() || phase.label),
          templateCode: typeof draft.formationData.code === 'string' ? draft.formationData.code : null,
          players: fromFormationPlayers(draft.formationData.players),
          bench: fromFormationPlayers(draft.formationData.bench),
          substitution: phase.substitution
            ? {
                ...phase.substitution,
                note: draft.formationData.notes ?? phase.substitution.note ?? null,
              }
            : null,
        };
      }),
    };

    setMatchPlan(updatedPlan);
    await persistMatchPlan(updatedPlan, 'Spielformation gespeichert.');
  }, [editorState.pendingPhase, editorState.phaseId, matchPlan, persistMatchPlan]);

  const handlePortfolioSaved = useCallback((formation: Formation) => {
    setFormations(current => {
      if (current.some(item => item.id === formation.id)) {
        return current.map(item => item.id === formation.id ? formation : item);
      }
      return [formation, ...current];
    });
    setSelectedFormationId(formation.id);
  }, []);

  const handleOpenPortfolioImport = useCallback(() => {
    setPortfolioDialog({
      open: true,
      formationId: selectedFormationId,
    });
  }, [selectedFormationId]);

  const handleImportSelectedFormationIntoStart = useCallback(async () => {
    if (!portfolioDialog.formationId) return;
    const formation = formations.find(item => item.id === portfolioDialog.formationId);
    if (!formation) return;

    const nextPlan: MatchPlan = {
      ...matchPlan,
      selectedTeamId,
      sourceFormationId: formation.id,
      phases: matchPlan.phases.map((phase, index) => {
        if (index !== 0) return phase;
        return {
          ...phase,
          minute: 0,
          label: 'Start',
          sourceType: 'start',
          templateCode: typeof formation.formationData.code === 'string' ? formation.formationData.code : null,
          players: fromFormationPlayers(formation.formationData.players),
          bench: fromFormationPlayers(formation.formationData.bench),
          substitution: null,
          confirmedEventId: null,
          confirmedAt: null,
        };
      }),
    };

    setMatchPlan(nextPlan);
    setSelectedFormationId(formation.id);
    setPortfolioDialog({ open: false, formationId: formation.id });
    await persistMatchPlan(nextPlan, 'Startformation aus Portfolio übernommen.');
  }, [formations, matchPlan, persistMatchPlan, portfolioDialog.formationId, selectedTeamId]);

  const handleOpenCreatePhaseDialog = useCallback((basePhase: MatchPlanPhase) => {
    setPhaseDialog({
      ...getDefaultPhaseDialogState(basePhase.minute, basePhase.id),
      open: true,
    });
  }, []);

  const handleCreatePhase = useCallback(() => {
    const basePhase = matchPlan.phases.find(phase => phase.id === phaseDialog.basePhaseId) ?? startPhase;
    const minuteValue = parseInt(phaseDialog.minute, 10);
    if (!Number.isFinite(minuteValue) || minuteValue < 0) {
      showToast('Bitte eine gültige Minute eingeben.', 'error');
      return;
    }

    const minuteInSeconds = minuteValue * 60;
    if (minuteInSeconds <= basePhase.minute) {
      showToast('Die neue Spielformation muss nach der Ausgangsformation liegen.', 'error');
      return;
    }

    const nextPhase: MatchPlanPhase = {
      id: createPhaseId(),
      minute: minuteInSeconds,
      label: phaseDialog.label.trim() || 'Spielformation',
      sourceType: 'shape_change',
      templateCode: basePhase.templateCode ?? null,
      players: clonePlayers(basePhase.players),
      bench: clonePlayers(basePhase.bench),
      substitution: null,
      confirmedEventId: null,
      confirmedAt: null,
    };

    setPhaseDialog(current => ({ ...current, open: false }));
    setEditorState({
      open: true,
      mode: 'phase',
      title: `${formatMatchMinute(nextPhase.minute)} bearbeiten`,
      saveButtonLabel: 'Für dieses Spiel übernehmen',
      formationId: null,
      phaseId: null,
      draft: buildPhaseDraft(nextPhase, selectedTeamId),
      initialShowTemplatePicker: false,
      pendingPhase: nextPhase,
    });
  }, [matchPlan.phases, phaseDialog, selectedTeamId, showToast, startPhase]);

  const handleClearStartFormation = useCallback(async (removeFollowingPhases: boolean) => {
    const nextPlan: MatchPlan = {
      ...matchPlan,
      sourceFormationId: null,
      phases: removeFollowingPhases
        ? [{
            ...createEmptyStartPhase(),
            id: matchPlan.phases[0]?.id ?? createPhaseId(),
          }]
        : matchPlan.phases.map((phase, index) => {
            if (index !== 0) return phase;
            return {
              ...phase,
              minute: 0,
              label: 'Start',
              sourceType: 'start',
              templateCode: null,
              players: [],
              bench: [],
              substitution: null,
              confirmedEventId: null,
              confirmedAt: null,
            };
          }),
    };

    setMatchPlan(nextPlan);
    setSelectedFormationId('');
    setClearStartDialog({ open: false });
    await persistMatchPlan(nextPlan, removeFollowingPhases ? 'Startformation und Folgeformationen entfernt.' : 'Startformation entfernt.');
  }, [matchPlan, persistMatchPlan]);

  const handleOpenClearStartFormation = useCallback(() => {
    if (gamePhases.length === 0) {
      void handleClearStartFormation(false);
      return;
    }
    setClearStartDialog({ open: true });
  }, [gamePhases.length, handleClearStartFormation]);

  const handleDeletePhase = useCallback(async (phaseId: string) => {
    const remainingPhases = matchPlan.phases.filter(phase => phase.id !== phaseId);
    const nextPlan: MatchPlan = {
      ...matchPlan,
      phases: remainingPhases.length > 0 ? remainingPhases : [createEmptyStartPhase()],
    };

    setMatchPlan(nextPlan);
    await persistMatchPlan(nextPlan, 'Spielformation entfernt.');
  }, [matchPlan, persistMatchPlan]);

  const handlePublishToggle = useCallback(async (publish: boolean) => {
    const nextPlan: MatchPlan = {
      ...matchPlan,
      published: publish,
      publishedAt: publish ? new Date().toISOString() : null,
    };

    setMatchPlan(nextPlan);
    await persistMatchPlan(nextPlan, publish ? 'Match-Plan für Spieler freigegeben.' : 'Freigabe des Match-Plans aufgehoben.');
  }, [matchPlan, persistMatchPlan]);

  const handleSelectedTeamChange = useCallback(async (nextTeamId: number) => {
    if (!Number.isFinite(nextTeamId) || nextTeamId <= 0 || nextTeamId === selectedTeamId) {
      return;
    }

    const nextPlan: MatchPlan = {
      ...matchPlan,
      selectedTeamId: nextTeamId,
      published: false,
      publishedAt: null,
    };

    setMatchPlan(nextPlan);
    await persistMatchPlan(
      nextPlan,
      matchPlan.published
        ? 'Zielteam geändert. Die Freigabe wurde aufgehoben und muss neu gesetzt werden.'
        : 'Zielteam für die Freigabe gespeichert.',
    );
  }, [matchPlan, persistMatchPlan, selectedTeamId]);

  const squadHint = hasParticipationData
    ? 'Spielernamen werden mit den Zusagen für dieses Spiel abgeglichen.'
    : 'Es gibt noch keine Zusagen für dieses Spiel. Spielerdaten kommen aus den aktiven Teams.';

  if (!canManageMatchPlan && !canViewMatchPlan) {
    return null;
  }

  const isReadOnlyPlayerView = canViewMatchPlan && !canManageMatchPlan;

  return (
    <>
      <Card sx={{ mb: 3, overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { xs: 2, sm: 3 },
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.primary.main, 0.03),
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <SportsSoccerIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '0.98rem', sm: '1.05rem' } }}>
              {isReadOnlyPlayerView ? 'Match-Plan des Trainers' : 'Formationen für dieses Spiel'}
            </Typography>
            <Chip size="small" label={`${sortedPhases.length} gespeichert`} sx={{ fontWeight: 700 }} />
            <Chip size="small" color={publicationStatus.color} icon={matchPlan.published ? <VisibilityIcon /> : <LockOpenIcon />} label={publicationStatus.label} sx={{ fontWeight: 700 }} />
          </Box>
          {canPublishMatchPlan && (
            <Button
              size="small"
              variant={matchPlan.published ? 'outlined' : 'contained'}
              color={matchPlan.published ? 'inherit' : 'primary'}
              startIcon={matchPlan.published ? <LockOpenIcon /> : <VisibilityIcon />}
              onClick={() => void handlePublishToggle(!matchPlan.published)}
              disabled={saving || selectedTeamId == null}
            >
              {matchPlan.published ? 'Freigabe aufheben' : 'Für Spieler freigeben'}
            </Button>
          )}
        </Box>

        <CardContent sx={{ px: { xs: 1.25, sm: 2.5 }, py: { xs: 1.25, sm: 2.5 } }}>
          <Stack spacing={1.5}>
            <Alert severity={isReadOnlyPlayerView ? 'success' : 'info'} sx={{ py: 0.5 }}>
              {isReadOnlyPlayerView
                ? `Du siehst die freigegebene Version für dein Team. ${publicationStatus.hint}`
                : `Lege die Startformation fest, plane Folgeformationen und gib den Plan erst frei, wenn die Spieler ihn sehen sollen. ${publicationStatus.hint}`}
            </Alert>


            <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <FormationPreview players={startPhase.players} onClick={() => setPreviewDialog({ open: true, phaseId: startPhase.id })} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight={800}>Startformation</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {startPhase.players.length > 0
                      ? `${startPhase.players.length} auf dem Feld, ${startPhase.bench.length} auf der Bank.`
                      : 'Noch keine Startformation für dieses Spiel gesetzt.'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {isReadOnlyPlayerView ? 'Tippe auf die Vorschau für die große Ansicht.' : (loadingResources ? 'Lade Spieldaten…' : squadHint)}
                  </Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                    <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => setPreviewDialog({ open: true, phaseId: startPhase.id })}>
                      Vorschau
                    </Button>
                    {!isReadOnlyPlayerView && (
                      <>
                        <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={() => openPhaseEditor(startPhase)} disabled={!canManageMatchPlan}>
                          Bearbeiten
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<FileOpenIcon />} onClick={() => openPhaseTemplatePicker(startPhase)} disabled={!canManageMatchPlan}>
                          Vorlage
                        </Button>
                        <Button size="small" variant="text" onClick={handleOpenPortfolioImport} disabled={loadingResources}>
                          Portfolio laden
                        </Button>
                        <Button size="small" variant="text" color="error" startIcon={<DeleteOutlineIcon />} onClick={handleOpenClearStartFormation} disabled={!canManageMatchPlan || (startPhase.players.length === 0 && startPhase.bench.length === 0)}>
                          Entfernen
                        </Button>
                      </>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>Spielformationen</Typography>
                <Typography variant="body2" color="text.secondary">
                  {isReadOnlyPlayerView
                    ? 'Alle Folgeformationen sind read-only und zeigen Wechsel sowie Umstellungen im Zeitverlauf.'
                    : 'Öffne eine Formation zum Anpassen oder lege aus ihr direkt die nächste Spielformation an.'}
                </Typography>
              </Box>
              {!isReadOnlyPlayerView && (
                <Button size="small" variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenCreatePhaseDialog(gamePhases[gamePhases.length - 1] ?? startPhase)} disabled={!canManageMatchPlan}>
                  Neue Formation
                </Button>
              )}
            </Box>

            {gamePhases.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, textAlign: 'center' }}>
                <Typography variant="body1" fontWeight={700} sx={{ mb: 0.5 }}>
                  Noch keine Spielformationen geplant
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                  {isReadOnlyPlayerView
                    ? 'Aktuell hat der Trainer nur die Startformation freigegeben.'
                    : 'Lege die erste Folgeformation an, wenn du einen Wechsel oder eine Umstellung für später vorbereiten willst.'}
                </Typography>
                {!isReadOnlyPlayerView && (
                  <Button size="small" variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenCreatePhaseDialog(startPhase)} disabled={!canManageMatchPlan}>
                    Erste Formation anlegen
                  </Button>
                )}
              </Paper>
            ) : (
              <Stack spacing={1.25}>
                {gamePhases.map(phase => {
                  const analysis = phaseAnalyses.get(phase.id) ?? {
                    kind: 'unchanged' as const,
                    substitution: null,
                    summary: 'Keine Änderung zur vorherigen Formation.',
                  };
                  const chip = getAnalysisChipProps(analysis);

                  return (
                    <Paper
                      key={phase.id}
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        borderRadius: 3,
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <FormationPreview players={phase.players} onClick={() => setPreviewDialog({ open: true, phaseId: phase.id })} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                            <Typography variant="subtitle1" fontWeight={800}>{formatMatchMinute(phase.minute)}</Typography>
                            <Chip size="small" icon={chip.icon} label={chip.label} color={chip.color} variant="outlined" />
                          </Stack>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {phase.label.trim() || 'Spielformation'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {analysis.summary}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {phase.players.length} auf dem Feld · {phase.bench.length} auf der Bank
                          </Typography>
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                            <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => setPreviewDialog({ open: true, phaseId: phase.id })}>
                              Vorschau
                            </Button>
                            {!isReadOnlyPlayerView && (
                              <>
                                <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={() => openPhaseEditor(phase)} disabled={!canManageMatchPlan}>
                                  Bearbeiten
                                </Button>
                                <Button size="small" variant="text" onClick={() => handleOpenCreatePhaseDialog(phase)} disabled={!canManageMatchPlan}>
                                  Folge
                                </Button>
                                <Button size="small" variant="text" onClick={() => openPhaseAsPortfolio(phase)}>
                                  Portfolio
                                </Button>
                                <Button size="small" variant="text" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => void handleDeletePhase(phase.id)} disabled={!canManageMatchPlan}>
                                  Entfernen
                                </Button>
                              </>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={phaseDialog.open} onClose={() => setPhaseDialog(current => ({ ...current, open: false }))} fullWidth maxWidth="sm">
        <DialogTitle>Neue Spielformation anlegen</DialogTitle>
        <DialogContent sx={{ pt: 1, display: 'grid', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Die neue Formation übernimmt alle Spieler und Positionen aus der gewählten Ausgangsformation. Danach kannst du sie direkt anpassen.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {[45, 60, 70, 80].map(minute => (
              <Chip
                key={minute}
                label={`${minute}'`}
                clickable
                color={phaseDialog.minute === String(minute) ? 'primary' : 'default'}
                onClick={() => setPhaseDialog(current => ({ ...current, minute: String(minute) }))}
              />
            ))}
          </Stack>
          <TextField type="number" label="Minute" value={phaseDialog.minute} onChange={event => setPhaseDialog(current => ({ ...current, minute: event.target.value }))} />
          <TextField label="Bezeichnung" value={phaseDialog.label} onChange={event => setPhaseDialog(current => ({ ...current, label: event.target.value }))} placeholder="z. B. Pressing höher" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPhaseDialog(current => ({ ...current, open: false }))}>Abbrechen</Button>
          <Button variant="contained" onClick={handleCreatePhase}>Weiter</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={portfolioDialog.open} onClose={() => setPortfolioDialog(current => ({ ...current, open: false }))} fullWidth maxWidth="sm">
        <DialogTitle>Startformation aus Portfolio laden</DialogTitle>
        <DialogContent sx={{ pt: 1, display: 'grid', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Die gewählte Aufstellung wird als Startformation in dieses Spiel übernommen und kann danach unabhängig weiterbearbeitet werden.
          </Typography>
          <TextField
            select
            label="Portfolio-Aufstellung"
            value={portfolioDialog.formationId}
            onChange={event => setPortfolioDialog(current => ({ ...current, formationId: event.target.value ? Number(event.target.value) : '' }))}
          >
            <MenuItem value="">Bitte auswählen</MenuItem>
            {formations.map(formation => (
              <MenuItem key={formation.id} value={formation.id}>{formation.name}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPortfolioDialog(current => ({ ...current, open: false }))}>Abbrechen</Button>
          <Button variant="contained" onClick={() => void handleImportSelectedFormationIntoStart()} disabled={!portfolioDialog.formationId}>
            Übernehmen
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={clearStartDialog.open} onClose={() => setClearStartDialog({ open: false })} fullWidth maxWidth="sm">
        <DialogTitle>Startformation entfernen</DialogTitle>
        <DialogContent sx={{ pt: 1, display: 'grid', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Auf dieser Startformation bauen bereits weitere Spielformationen auf. Wähle, ob nur die Startformation geleert oder der komplette darauf aufbauende Plan entfernt werden soll.
          </Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2.5 }}>
              <Typography variant="subtitle2" fontWeight={800}>Nur Startformation entfernen</Typography>
              <Typography variant="body2" color="text.secondary">
                Die Startformation wird geleert. Alle Folgeformationen bleiben erhalten.
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2.5, borderColor: 'warning.main', bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
              <Typography variant="subtitle2" fontWeight={800}>Startformation und Folgeformationen entfernen</Typography>
              <Typography variant="body2" color="text.secondary">
                Der komplette Spielplan ab Anpfiff wird zurückgesetzt. Übrig bleibt nur eine leere Startformation.
              </Typography>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setClearStartDialog({ open: false })}>Abbrechen</Button>
          <Button variant="outlined" color="warning" onClick={() => void handleClearStartFormation(false)}>
            Nur Startformation
          </Button>
          <Button variant="contained" color="error" onClick={() => void handleClearStartFormation(true)}>
            Alles entfernen
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={previewDialog.open} onClose={() => setPreviewDialog({ open: false, phaseId: null })} fullWidth maxWidth="md">
        <DialogTitle>
          {previewPhase
            ? (previewPhase.minute === 0 ? 'Startformation' : `${formatMatchMinute(previewPhase.minute)} ${previewPhase.label.trim() || 'Spielformation'}`)
            : 'Formation'}
        </DialogTitle>
        <DialogContent sx={{ pt: 1, display: 'grid', gap: 2 }}>
          {previewPhase && (
            <>
              <FormationPreview players={previewPhase.players} size="large" />
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>Zusammenfassung</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {previewPhase.minute === 0
                    ? 'Startformation zum Anpfiff.'
                    : (previewAnalysis?.summary ?? 'Keine Änderung zur vorherigen Formation.')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>Bank</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {previewPhase.bench.length > 0
                    ? previewPhase.bench.map(player => player.name || `#${player.number}`).join(', ')
                    : 'Keine Bankspieler hinterlegt.'}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog({ open: false, phaseId: null })}>Schließen</Button>
        </DialogActions>
      </Dialog>

      <FormationEditModal
        open={editorState.open}
        formationId={editorState.formationId}
        initialDraft={editorState.draft}
        initialShowTemplatePicker={editorState.initialShowTemplatePicker}
        title={editorState.title}
        saveButtonLabel={editorState.saveButtonLabel}
        onClose={() => setEditorState(current => ({ ...current, open: false, formationId: null, phaseId: null, draft: undefined, initialShowTemplatePicker: false, pendingPhase: undefined }))}
        onSaved={editorState.mode === 'portfolio' ? handlePortfolioSaved : undefined}
        onSaveDraft={editorState.mode === 'phase' ? handlePhaseDraftSave : undefined}
      />
    </>
  );
}
