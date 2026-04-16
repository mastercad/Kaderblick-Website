import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { fetchClubSeasonOverview } from '../services/clubSeason';
import EmptyStateHint from '../components/EmptyStateHint';
import {
  ClubSeasonOverview,
  FormResult,
  TeamSeasonData,
  TopScorer,
} from '../types/clubSeason';

// ── Form chip helpers ──────────────────────────────────────────────────────────

function formColor(result: FormResult): 'success' | 'warning' | 'error' | 'default' {
  if (result === 'W') return 'success';
  if (result === 'D') return 'warning';
  if (result === 'L') return 'error';
  return 'default';
}

function formLabel(result: FormResult): string {
  if (result === 'W') return 'S';
  if (result === 'D') return 'U';
  if (result === 'L') return 'N';
  return result;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TeamCard({ team }: { team: TeamSeasonData }) {
  const { stats } = team;

  const nextGameText = team.nextGame
    ? (() => {
        const date = new Date(team.nextGame.date);
        const home = team.nextGame.homeTeam?.name ?? '?';
        const away = team.nextGame.awayTeam?.name ?? '?';
        return `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} · ${home} – ${away}`;
      })()
    : 'Kein Spiel geplant';

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <GroupsIcon fontSize="small" color="action" />
          <Typography variant="subtitle1" fontWeight={600}>
            {team.name}
          </Typography>
          {team.ageGroup && (
            <Chip label={team.ageGroup.name} size="small" variant="outlined" />
          )}
          {team.league && (
            <Chip label={team.league.name} size="small" color="primary" variant="outlined" />
          )}
        </Stack>

        {/* Stats row */}
        <Stack direction="row" spacing={3} mb={1.5} flexWrap="wrap">
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">Sp</Typography>
            <Typography variant="body2" fontWeight={600}>{stats.played}</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">S</Typography>
            <Typography variant="body2" fontWeight={600} color="success.main">{stats.won}</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">U</Typography>
            <Typography variant="body2" fontWeight={600} color="warning.main">{stats.drawn}</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">N</Typography>
            <Typography variant="body2" fontWeight={600} color="error.main">{stats.lost}</Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">Tore</Typography>
            <Typography variant="body2" fontWeight={600}>
              {stats.goalsFor}:{stats.goalsAgainst}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption" color="text.secondary">Pkt</Typography>
            <Typography variant="body2" fontWeight={700} color="primary.main">{stats.points}</Typography>
          </Box>
        </Stack>

        {/* Form streak */}
        {team.form.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center" mb={1}>
            <Typography variant="caption" color="text.secondary" mr={0.5}>Form:</Typography>
            {team.form.map((r, i) => (
              <Chip
                key={i}
                label={formLabel(r)}
                color={formColor(r)}
                size="small"
                sx={{ fontWeight: 700, minWidth: 28 }}
              />
            ))}
          </Stack>
        )}

        {/* Next game */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <SportsSoccerIcon fontSize="inherit" color="disabled" />
          <Typography variant="caption" color="text.secondary">
            Nächstes Spiel: {nextGameText}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function TopScorerList({ scorers }: { scorers: TopScorer[] }) {
  if (scorers.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Keine Tore in dieser Saison.
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>#</TableCell>
          <TableCell>Spieler</TableCell>
          <TableCell>Team</TableCell>
          <TableCell align="right">Tore</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {scorers.map((scorer, idx) => (
          <TableRow key={`${scorer.playerId}-${scorer.teamId}`}>
            <TableCell>
              {idx === 0 ? (
                <EmojiEventsIcon fontSize="small" sx={{ color: 'gold' }} />
              ) : (
                <Typography variant="body2" color="text.disabled">{idx + 1}</Typography>
              )}
            </TableCell>
            <TableCell>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>
                  {scorer.firstName[0]}{scorer.lastName[0]}
                </Avatar>
                <Typography variant="body2">
                  {scorer.firstName} {scorer.lastName}
                </Typography>
              </Stack>
            </TableCell>
            <TableCell>
              <Typography variant="body2" color="text.secondary">{scorer.teamName}</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight={700}>{scorer.goals}</Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Main page component ────────────────────────────────────────────────────────

export default function ClubSeason() {
  const [data, setData] = useState<ClubSeasonOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchClubSeasonOverview(selectedSeason ?? undefined)
      .then((overview) => {
        setData(overview);
        if (selectedSeason === null) {
          setSelectedSeason(overview.seasonYear);
        }
      })
      .catch(() => setError('Vereinsdaten konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [selectedSeason]);

  const handleSeasonChange = (year: number) => {
    setSelectedSeason(year);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;
  }

  if (!data || !data.club) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 1, sm: 2 } }}>
        <EmptyStateHint
          icon={<GroupsIcon />}
          title="Kein Verein gefunden"
          description="Du bist keinem Verein zugeordnet. Bitte wende dich an einen Administrator."
        />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 1, sm: 2 }, pb: 4 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3} mt={2}>
        {data.club.logoUrl ? (
          <Avatar src={data.club.logoUrl} sx={{ width: 48, height: 48 }} />
        ) : (
          <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
            <GroupsIcon />
          </Avatar>
        )}
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {data.club.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Saison-Übersicht
          </Typography>
        </Box>

        <Box ml="auto">
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel id="season-label">Saison</InputLabel>
            <Select
              labelId="season-label"
              label="Saison"
              value={selectedSeason ?? data.seasonYear}
              onChange={(e) => handleSeasonChange(Number(e.target.value))}
            >
              {data.availableSeasons.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}/{year + 1}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      {/* Teams */}
      <Typography variant="h6" fontWeight={600} mb={2}>
        Teams ({data.teams.length})
      </Typography>

      {data.teams.length === 0 ? (
        <EmptyStateHint
          icon={<GroupsIcon />}
          title="Keine Teams"
          description="Für diese Saison wurden keine Teams gefunden."
          compact
        />
      ) : (
        data.teams.map((team) => <TeamCard key={team.id} team={team} />)
      )}

      <Divider sx={{ my: 3 }} />

      {/* Top Scorers */}
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <EmojiEventsIcon color="warning" />
        <Typography variant="h6" fontWeight={600}>
          Torschützen – Saison {data.season}
        </Typography>
      </Stack>

      <TopScorerList scorers={data.topScorers} />
    </Box>
  );
}
