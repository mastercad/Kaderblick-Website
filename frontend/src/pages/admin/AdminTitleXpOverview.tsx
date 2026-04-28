import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Chip,
  Avatar,
  Card,
  CardContent,
  Grid,
  InputAdornment,
  TextField,
  Divider,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PeopleIcon from '@mui/icons-material/People';
import StarIcon from '@mui/icons-material/Star';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import GroupsIcon from '@mui/icons-material/Groups';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import { apiJson } from '../../utils/api';

/* ── Helpers ───────────────────────────────────────── */

type Scope = 'platform' | 'league' | 'team';
type Rank  = 'gold' | 'silver' | 'bronze';

const SCOPE_ORDER: Record<Scope, number> = { platform: 0, league: 1, team: 2 };
const RANK_ORDER:  Record<Rank,  number> = { gold: 0, silver: 1, bronze: 2 };

const SCOPE_META: Record<Scope, { label: string; color: string; bgcolor: string; icon: React.ReactElement }> = {
  platform: { label: 'Plattform', color: '#1565c0', bgcolor: '#e3f2fd', icon: <PublicIcon fontSize="small" /> },
  league:   { label: 'Liga',      color: '#e65100', bgcolor: '#fff3e0', icon: <LeaderboardIcon fontSize="small" /> },
  team:     { label: 'Team',      color: '#2e7d32', bgcolor: '#e8f5e9', icon: <GroupsIcon fontSize="small" /> },
};

const RANK_META: Record<Rank, { label: string; color: string; bgcolor: string; borderColor: string }> = {
  gold:   { label: 'Gold',   color: '#7d5200', bgcolor: '#fff8e1', borderColor: '#f9a825' },
  silver: { label: 'Silber', color: '#424242', bgcolor: '#f5f5f5', borderColor: '#9e9e9e' },
  bronze: { label: 'Bronze', color: '#4e342e', bgcolor: '#fbe9e7', borderColor: '#bf360c' },
};

const RANK_ICON_COLOR: Record<Rank, string> = {
  gold:   '#f9a825',
  silver: '#9e9e9e',
  bronze: '#bf360c',
};

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName || lastName) {
    return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
  }
  return (email || '?')[0].toUpperCase();
}

function sortTitles(titles: any[]): any[] {
  return [...titles].sort((a, b) => {
    const scopeA = SCOPE_ORDER[(a.titleScope as Scope)] ?? 99;
    const scopeB = SCOPE_ORDER[(b.titleScope as Scope)] ?? 99;
    if (scopeA !== scopeB) return scopeA - scopeB;
    if (a.titleScope === 'platform') {
      return (RANK_ORDER[(a.titleRank as Rank)] ?? 99) - (RANK_ORDER[(b.titleRank as Rank)] ?? 99);
    }
    if (a.titleScope === 'league') {
      const cmp = (a.leagueName || '').localeCompare(b.leagueName || '');
      return cmp !== 0 ? cmp : (RANK_ORDER[(a.titleRank as Rank)] ?? 99) - (RANK_ORDER[(b.titleRank as Rank)] ?? 99);
    }
    if (a.titleScope === 'team') {
      const cmp = (a.teamName || '').localeCompare(b.teamName || '');
      return cmp !== 0 ? cmp : (RANK_ORDER[(a.titleRank as Rank)] ?? 99) - (RANK_ORDER[(b.titleRank as Rank)] ?? 99);
    }
    return 0;
  });
}

/* ── Sub-components ────────────────────────────────── */

interface StatCardProps {
  icon: React.ReactElement;
  label: string;
  value: number | string;
  color: string;
  bgcolor: string;
}

function StatCard({ icon, label, value, color, bgcolor }: StatCardProps) {
  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor, color, display: 'flex', alignItems: 'center', '& svg': { fontSize: '28px !important' } }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700} color="text.primary" lineHeight={1}>{value}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

interface RankChipProps { rank: string }
function RankChip({ rank }: RankChipProps) {
  const meta = RANK_META[rank as Rank];
  if (!meta) return <Chip label={rank} size="small" variant="outlined" />;
  return (
    <Chip
      icon={<EmojiEventsIcon style={{ color: RANK_ICON_COLOR[rank as Rank] }} />}
      label={meta.label}
      size="small"
      sx={{
        bgcolor: meta.bgcolor,
        color: meta.color,
        border: `1px solid ${meta.borderColor}`,
        fontWeight: 600,
        fontSize: '0.75rem',
      }}
    />
  );
}

interface ScopeChipProps { scope: string }
function ScopeChip({ scope }: ScopeChipProps) {
  const meta = SCOPE_META[scope as Scope];
  if (!meta) return <Chip label={scope} size="small" variant="outlined" />;
  return (
    <Chip
      icon={meta.icon}
      label={meta.label}
      size="small"
      sx={{ bgcolor: meta.bgcolor, color: meta.color, fontWeight: 600, fontSize: '0.75rem', '& .MuiChip-icon': { color: meta.color } }}
    />
  );
}

/* ── Main component ────────────────────────────────── */

const AdminTitleXpOverview: React.FC = () => {
  const [loading, setLoading]     = React.useState(true);
  const [error, setError]         = React.useState<string | null>(null);
  const [titles, setTitles]       = React.useState<any[]>([]);
  const [users, setUsers]         = React.useState<any[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState<any | null>(null);
  const [modalUsers, setModalUsers] = React.useState<any[]>([]);
  const [userSearch, setUserSearch] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    apiJson('/api/admin/title-xp-overview')
      .then((data) => {
        setTitles(data.titles || []);
        setUsers(data.users || []);
        setError(null);
      })
      .catch(() => setError('Fehler beim Laden der Übersicht'))
      .finally(() => setLoading(false));
  }, []);

  const handleUserCountClick = (title: any) => {
    setModalTitle(title);
    setModalUsers(title.players || []);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalTitle(null);
    setModalUsers([]);
  };

  const filteredUsers = React.useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const maxXp = React.useMemo(() => Math.max(...users.map((u) => u.xp || 0), 1), [users]);

  // --- Stats ---
  const totalTitlesAwarded = titles.reduce((sum, t) => sum + (t.userCount || 0), 0);
  const platformTitles = titles.filter((t) => t.titleScope === 'platform').length;
  const teamTitles     = titles.filter((t) => t.titleScope === 'team').length;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.main', color: 'white', display: 'flex' }}>
          <EmojiEventsIcon sx={{ fontSize: 32 }} />
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={700} color="text.primary">Titel & XP Übersicht</Typography>
          <Typography variant="body2" color="text.secondary">Rang-Übersicht aller vergebenen Titel und Spieler-Fortschritte</Typography>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, my: 8 }}>
          <CircularProgress size={48} />
          <Typography color="text.secondary">Daten werden geladen …</Typography>
        </Box>
      ) : error ? (
        <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>{error}</Alert>
      ) : (
        <>
          {/* ── Stats Cards ── */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard icon={<EmojiEventsIcon />} label="Vergeb. Titel gesamt" value={totalTitlesAwarded} color="#1565c0" bgcolor="#e3f2fd" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard icon={<PeopleIcon />} label="Spieler gesamt" value={users.length} color="#2e7d32" bgcolor="#e8f5e9" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard icon={<PublicIcon />} label="Plattform-Titel" value={platformTitles} color="#6a1b9a" bgcolor="#f3e5f5" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard icon={<GroupsIcon />} label="Team-Titel" value={teamTitles} color="#e65100" bgcolor="#fff3e0" />
            </Grid>
          </Grid>

          {/* ── Titles table ── */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{
              position: 'sticky',
              top: 'var(--app-header-height)',
              zIndex: 9,
              px: 3, py: 2,
              display: 'flex', alignItems: 'center', gap: 1.5,
              bgcolor: 'grey.50',
              border: '1px solid', borderColor: 'divider',
              borderRadius: '8px 8px 0 0',
            }}>
              <EmojiEventsIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>Vergebene Titel</Typography>
              <Chip label={titles.length} size="small" color="primary" sx={{ ml: 'auto' }} />
            </Box>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderTop: 0, borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' } }}>
                    <TableCell>Kategorie</TableCell>
                    <TableCell>Bereich</TableCell>
                    <TableCell>Rang</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell align="center">Spieler</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortTitles(titles).map((t, idx) => {
                    let name = '-';
                    if (t.titleScope === 'team')         name = t.teamName   || '-';
                    else if (t.titleScope === 'league')  name = t.leagueName || '-';
                    else if (t.titleScope === 'platform') name = 'Plattform';
                    return (
                      <TableRow
                        key={idx}
                        hover
                        sx={{ '&:last-child td': { border: 0 } }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{t.titleCategory || '-'}</Typography>
                        </TableCell>
                        <TableCell><ScopeChip scope={t.titleScope} /></TableCell>
                        <TableCell><RankChip rank={t.titleRank} /></TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{name}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Spieler anzeigen" arrow>
                            <Chip
                              icon={<PeopleIcon />}
                              label={t.userCount}
                              size="small"
                              color={t.userCount > 0 ? 'primary' : 'default'}
                              variant={t.userCount > 0 ? 'filled' : 'outlined'}
                              clickable={t.userCount > 0}
                              onClick={t.userCount > 0 ? () => handleUserCountClick(t) : undefined}
                              sx={{ fontWeight: 600, cursor: t.userCount > 0 ? 'pointer' : 'default' }}
                            />
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {titles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        Noch keine Titel vergeben.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            </Paper>
          </Box>

          {/* ── Users table ── */}
          <Box>
            <Box sx={{
              position: 'sticky',
              top: 'var(--app-header-height)',
              zIndex: 9,
              px: 3, py: 2,
              display: 'flex', alignItems: 'center', gap: 1.5,
              bgcolor: 'grey.50',
              border: '1px solid', borderColor: 'divider',
              borderRadius: '8px 8px 0 0',
              flexWrap: 'wrap', rowGap: 1,
            }}>
              <StarIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>Spieler – Level & XP</Typography>
              <Chip label={users.length} size="small" color="primary" />
              <TextField
                size="small"
                placeholder="Spieler suchen …"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                sx={{ ml: 'auto', minWidth: 220 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderTop: 0, borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: 'grey.50', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' } }}>
                    <TableCell>Spieler</TableCell>
                    <TableCell>E-Mail</TableCell>
                    <TableCell>Aktueller Titel</TableCell>
                    <TableCell align="center">Level</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>XP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '–';
                    const initials = getInitials(u.firstName, u.lastName, u.email);
                    const level = u.level ?? 0;
                    const xp    = u.xp    ?? 0;
                    const xpPct = Math.min(100, Math.round((xp / maxXp) * 100));
                    return (
                      <TableRow key={u.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 36, height: 36, fontSize: '0.85rem', bgcolor: 'primary.main', fontWeight: 700 }}>
                              {initials}
                            </Avatar>
                            <Typography variant="body2" fontWeight={500}>{name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{u.email || '–'}</Typography>
                        </TableCell>
                        <TableCell>
                          {u.title
                            ? <Chip label={u.title} size="small" variant="outlined" color="primary" />
                            : <Typography variant="body2" color="text.disabled">–</Typography>
                          }
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`Lvl ${level}`}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              bgcolor: level >= 10 ? '#f3e5f5' : level >= 5 ? '#e8f5e9' : 'grey.100',
                              color:   level >= 10 ? '#6a1b9a'  : level >= 5 ? '#2e7d32'  : 'text.secondary',
                              border: '1px solid',
                              borderColor: level >= 10 ? '#ba68c8' : level >= 5 ? '#66bb6a' : 'divider',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flex: 1, minWidth: 80 }}>
                              <LinearProgress
                                variant="determinate"
                                value={xpPct}
                                sx={{
                                  height: 6,
                                  borderRadius: 3,
                                  bgcolor: 'grey.200',
                                  '& .MuiLinearProgress-bar': { borderRadius: 3 },
                                }}
                              />
                            </Box>
                            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ whiteSpace: 'nowrap', minWidth: 48, textAlign: 'right' }}>
                              {xp.toLocaleString()} XP
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        {userSearch ? 'Keine Spieler gefunden.' : 'Noch keine Spielerdaten vorhanden.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            </Paper>
          </Box>

          {/* ── Modal ── */}
          <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ pr: 6, pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {modalTitle && <RankChip rank={modalTitle.titleRank} />}
                {modalTitle && <ScopeChip scope={modalTitle.titleScope} />}
                <Typography component="span" fontWeight={600} sx={{ ml: 0.5 }}>
                  {modalTitle?.titleCategory || 'Titel'}
                </Typography>
              </Box>
              <IconButton
                aria-label="close"
                onClick={handleCloseModal}
                sx={{ position: 'absolute', right: 8, top: 12 }}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ pt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {modalUsers.length === 0
                  ? 'Noch kein Spieler hat diesen Titel erhalten.'
                  : `${modalUsers.length} Spieler ${modalUsers.length === 1 ? 'hat' : 'haben'} diesen Titel erhalten.`}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {modalUsers.map((u) => {
                  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '–';
                  const initials = getInitials(u.firstName, u.lastName, u.email);
                  return (
                    <Box
                      key={u.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'grey.50',
                      }}
                    >
                      <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 700 }}>{initials}</Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{name}</Typography>
                        <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </DialogContent>
          </Dialog>
        </>
      )}
    </Box>
  );
};

export default AdminTitleXpOverview;
