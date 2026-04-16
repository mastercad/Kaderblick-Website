import React, { useEffect, useState } from "react";
import { apiBlob } from '../utils/api';
import { apiJson } from '../utils/api';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Divider,
  useTheme,
  useMediaQuery,
  Stack,
  Chip,
  Tooltip,
  Avatar,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import GroupsIcon from '@mui/icons-material/Groups';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import EmptyStateHint from '../components/EmptyStateHint';

interface Player {
  id: number;
  name: string;
  shorts_size: string | null;
  shirt_size: string | null;
  shoe_size: string | null;
  socks_size: string | null;
  jacket_size: string | null;
}

interface Team {
  team_id: number;
  team_name: string;
  players: Player[];
}

interface SizeSummary {
  [size: string]: number;
}

const aggregateTeamSizes = (players: Player[], key: keyof Player): SizeSummary =>
  players.reduce((acc: SizeSummary, p) => {
    const val = p[key];
    if (val) acc[val as string] = (acc[val as string] || 0) + 1;
    return acc;
  }, {});

/** Sortiert Größen: XS/S/M/L/XL/XXL-aware, numerisch, sonst alphabetisch */
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const sortSizes = (entries: [string, number][]): [string, number][] =>
  [...entries].sort(([a], [b]) => {
    const ai = SIZE_ORDER.indexOf(a.toUpperCase());
    const bi = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

// Farbpalette für Größen-Chips
const SIZE_CHIP_COLORS: Record<string, { bg: string; color: string }> = {
  XS:   { bg: '#e8f5e9', color: '#2e7d32' },
  S:    { bg: '#e3f2fd', color: '#1565c0' },
  M:    { bg: '#fff8e1', color: '#f57f17' },
  L:    { bg: '#fce4ec', color: '#c62828' },
  XL:   { bg: '#f3e5f5', color: '#6a1b9a' },
  XXL:  { bg: '#e0f2f1', color: '#00695c' },
  XXXL: { bg: '#efebe9', color: '#4e342e' },
};
const getChipStyle = (size: string, isDark: boolean) => {
  const preset = SIZE_CHIP_COLORS[size.toUpperCase()];
  if (preset) {
    return isDark
      ? { bgcolor: alpha(preset.color, 0.2), color: preset.color }
      : { bgcolor: preset.bg, color: preset.color };
  }
  return isDark
    ? { bgcolor: alpha('#90a4ae', 0.2), color: '#b0bec5' }
    : { bgcolor: '#eceff1', color: '#455a64' };
};

// ─── SizeChip ───────────────────────────────────────────────────────────────

const SizeChip: React.FC<{ size: string | null }> = ({ size }) => {
  const theme = useTheme();
  if (!size) {
    return (
      <Tooltip title="Keine Angabe">
        <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic', userSelect: 'none' }}>–</Typography>
      </Tooltip>
    );
  }
  const style = getChipStyle(size, theme.palette.mode === 'dark');
  return (
    <Chip
      label={size}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: '0.72rem',
        letterSpacing: '0.03em',
        height: 24,
        borderRadius: '6px',
        bgcolor: style.bgcolor,
        color: style.color,
        border: 'none',
      }}
    />
  );
};

// ─── SizeSummarySection ─────────────────────────────────────────────────────

const SizeSummarySection: React.FC<{
  title: string;
  icon: React.ReactNode;
  summary: SizeSummary;
  accentColor: string;
  missingCount: number;
}> = ({ title, icon, summary, accentColor, missingCount }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const sorted = sortSizes(Object.entries(summary));

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 160,
        p: 2,
        borderRadius: 2,
        bgcolor: isDark ? alpha(accentColor, 0.08) : alpha(accentColor, 0.06),
        border: `1px solid ${alpha(accentColor, isDark ? 0.25 : 0.18)}`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: alpha(accentColor, isDark ? 0.22 : 0.15),
            color: accentColor,
          }}
        >
          {icon}
        </Avatar>
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: accentColor }}>
          {title}
        </Typography>
      </Stack>
      {sorted.length === 0 ? (
        <Typography variant="caption" color="text.disabled">Keine Daten</Typography>
      ) : (
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {sorted.map(([size, count]) => {
            const style = getChipStyle(size, isDark);
            return (
              <Chip
                key={size}
                label={`${size} × ${count}`}
                size="small"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  height: 26,
                  borderRadius: '8px',
                  bgcolor: style.bgcolor,
                  color: style.color,
                  border: 'none',
                }}
              />
            );
          })}
        </Stack>
      )}
      {missingCount > 0 && (
        <Stack direction="row" alignItems="center" spacing={0.5} mt={1.5}>
          <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
          <Typography variant="caption" color="warning.main">
            {missingCount} ohne Angabe
          </Typography>
        </Stack>
      )}
    </Box>
  );
};

// ─── Hauptkomponente ────────────────────────────────────────────────────────

const SizeGuide: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleDownloadPdf = async (teamId: number, teamName: string) => {
    setPdfDownloading(true);
    try {
      const blob = await apiBlob(`/api/teams/${teamId}/size-guide-pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke after a short delay to allow the new tab to load the blob
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      console.error('PDF-Öffnen fehlgeschlagen', e);
    } finally {
      setPdfDownloading(false);
    }
  };

  useEffect(() => {
    apiJson("/api/teams/size-guide-overview")
      .then((data: Team[]) => {
        setTeams(data);
        if (data.length > 0) {
          setSelectedTeamId(data[0].team_id);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedTeam = teams.find(t => t.team_id === selectedTeamId) ?? null;

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight={200} gap={2}>
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">Größendaten werden geladen …</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  return (
    <Box sx={{ width: '100%', px: { xs: 1.5, md: 4 }, py: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>

      {/* ── Seitenkopf ─────────────────────────────────────────── */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        mb={4}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar
            sx={{
              width: 52,
              height: 52,
              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
              color: 'primary.main',
            }}
          >
            <CheckroomIcon sx={{ fontSize: 28 }} />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
              Kleidergrößen
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.25}>
              Ausrüstungsgrößen der Spieler deines Teams
            </Typography>
          </Box>
        </Stack>

        {/* PDF-Download & Team-Auswahl */}
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
          {selectedTeamId !== '' && (
            <Button
              variant="contained"
              size="small"
              startIcon={pdfDownloading ? <CircularProgress size={15} color="inherit" /> : <PictureAsPdfIcon />}
              disabled={pdfDownloading}
              onClick={() => {
                const team = teams.find(t => t.team_id === selectedTeamId);
                if (team) handleDownloadPdf(team.team_id, team.team_name);
              }}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                fontSize: '0.82rem',
                textTransform: 'none',
                bgcolor: 'error.main',
                '&:hover': { bgcolor: 'error.dark' },
              }}
            >
              {pdfDownloading ? 'Wird erstellt…' : 'PDF exportieren'}
            </Button>
          )}
          {teams.length > 0 && (
          <FormControl
            size="small"
            sx={{ minWidth: 220, width: { xs: '100%', sm: 'auto' } }}
          >
            <InputLabel id="size-guide-team-label">Team</InputLabel>
            <Select
              labelId="size-guide-team-label"
              label="Team"
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value as number)}
              sx={{
                borderRadius: 2,
                bgcolor: isDark
                  ? alpha(theme.palette.primary.main, 0.08)
                  : alpha(theme.palette.primary.main, 0.04),
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: alpha(theme.palette.primary.main, isDark ? 0.3 : 0.2),
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.primary.main,
                },
              }}
            >
              {teams.map(t => (
                <MenuItem key={t.team_id} value={t.team_id}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <GroupsIcon sx={{ fontSize: 16, color: 'primary.main', opacity: 0.7 }} />
                    <span>{t.team_name}</span>
                    <Chip
                      label={t.players.length}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        ml: 0.5,
                      }}
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          )}
        </Stack>
      </Stack>

      {teams.length === 0 && (
        <EmptyStateHint
          icon={<CheckroomIcon />}
          title="Keine Teamdaten verfügbar"
          description="Du bist keinem Team als Trainer zugeordnet."
          compact
        />
      )}

      {/* ── Ausgewähltes Team ──────────────────────────────────── */}
      {selectedTeam !== null && (() => {
        const team = selectedTeam;
        const shortsSummary = aggregateTeamSizes(team.players, 'shorts_size');
        const shirtSummary  = aggregateTeamSizes(team.players, 'shirt_size');
        const shoeSummary   = aggregateTeamSizes(team.players, 'shoe_size');
        const socksSummary  = aggregateTeamSizes(team.players, 'socks_size');
        const jacketSummary = aggregateTeamSizes(team.players, 'jacket_size');

        const missingShorts  = team.players.filter(p => !p.shorts_size).length;
        const missingShirts  = team.players.filter(p => !p.shirt_size).length;
        const missingShoes   = team.players.filter(p => !p.shoe_size).length;
        const missingSocks   = team.players.filter(p => !p.socks_size).length;
        const missingJackets = team.players.filter(p => !p.jacket_size).length;

        return (
            <Paper
              key={team.team_id}
              elevation={isDark ? 2 : 3}
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {/* Team-Header */}
              <Box
                sx={{
                  px: { xs: 2, md: 3 },
                  py: 2,
                  background: isDark
                    ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.35)} 0%, ${alpha(theme.palette.primary.main, 0.15)} 100%)`
                    : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.10)} 0%, ${alpha(theme.palette.primary.light, 0.06)} 100%)`,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                    color: 'primary.main',
                  }}
                >
                  <GroupsIcon sx={{ fontSize: 20 }} />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h6" fontWeight={700} fontSize="1rem" lineHeight={1.2}>
                    {team.team_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {team.players.length} Spieler
                  </Typography>
                </Box>
                <Chip
                  label={`${team.players.length} Spieler`}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
                    color: 'primary.main',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    display: { xs: 'none', sm: 'flex' },
                  }}
                />
              </Box>

              {/* Tabelle */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow
                      sx={{
                        bgcolor: isDark
                          ? alpha(theme.palette.background.default, 0.6)
                          : alpha(theme.palette.grey[100], 0.8),
                      }}
                    >
                      {[
                        { label: 'Spieler', icon: null, align: 'left' as const },
                        { label: 'Hose', icon: <CheckroomIcon sx={{ fontSize: 14 }} />, align: 'center' as const },
                        { label: 'Trikot', icon: <CheckroomIcon sx={{ fontSize: 14 }} />, align: 'center' as const },
                        { label: 'Jacke', icon: <CheckroomIcon sx={{ fontSize: 14 }} />, align: 'center' as const },
                        { label: 'Schuh', icon: <DirectionsRunIcon sx={{ fontSize: 14 }} />, align: 'center' as const },
                        { label: 'Stutzen', icon: <DirectionsRunIcon sx={{ fontSize: 14 }} />, align: 'center' as const },
                      ].map((col) => (
                        <TableCell
                          key={col.label}
                          align={col.align}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'text.secondary',
                            py: 1.25,
                            px: { xs: 1, md: 2 },
                            borderBottom: `2px solid ${theme.palette.divider}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent={col.align === 'center' ? 'center' : 'flex-start'}
                            spacing={0.5}
                          >
                            {col.icon}
                            <span>{col.label}</span>
                          </Stack>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {team.players.map((player, idx) => (
                      <TableRow
                        key={player.id}
                        sx={{
                          bgcolor: idx % 2 === 0
                            ? 'transparent'
                            : isDark
                              ? alpha(theme.palette.action.hover, 0.4)
                              : alpha(theme.palette.grey[50], 0.7),
                          '&:last-child td': { border: 0 },
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
                            transition: 'background-color 0.15s',
                          },
                        }}
                      >
                        <TableCell sx={{ py: 1, px: { xs: 1, md: 2 }, fontWeight: 500, fontSize: '0.875rem' }}>
                          <Stack direction="row" alignItems="center" spacing={1.25}>
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                                color: 'primary.main',
                              }}
                            >
                              {player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" fontWeight={500} noWrap>
                              {player.name}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={player.shorts_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={player.shirt_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={player.jacket_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={player.shoe_size} />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1, px: { xs: 1, md: 2 } }}>
                          <SizeChip size={player.socks_size} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Größenverteilung */}
              <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
                <Divider sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ px: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  >
                    Größenverteilung
                  </Typography>
                </Divider>
                <Stack direction={isMobile ? 'column' : 'row'} spacing={1.5} useFlexGap flexWrap="wrap">
                  <SizeSummarySection
                    title="Hosen"
                    icon={<CheckroomIcon sx={{ fontSize: 16 }} />}
                    summary={shortsSummary}
                    accentColor={theme.palette.primary.main}
                    missingCount={missingShorts}
                  />
                  <SizeSummarySection
                    title="Trikots"
                    icon={<CheckroomIcon sx={{ fontSize: 16 }} />}
                    summary={shirtSummary}
                    accentColor={theme.palette.secondary.main}
                    missingCount={missingShirts}
                  />
                  <SizeSummarySection
                    title="Trainingsjacken"
                    icon={<CheckroomIcon sx={{ fontSize: 16 }} />}
                    summary={jacketSummary}
                    accentColor={theme.palette.warning.main}
                    missingCount={missingJackets}
                  />
                  <SizeSummarySection
                    title="Schuhe"
                    icon={<DirectionsRunIcon sx={{ fontSize: 16 }} />}
                    summary={shoeSummary}
                    accentColor={theme.palette.info.main}
                    missingCount={missingShoes}
                  />
                  <SizeSummarySection
                    title="Stutzen"
                    icon={<DirectionsRunIcon sx={{ fontSize: 16 }} />}
                    summary={socksSummary}
                    accentColor={theme.palette.success.main}
                    missingCount={missingSocks}
                  />
                </Stack>
              </Box>
            </Paper>
        );
      })()}
    </Box>
  );
};

export default SizeGuide;
