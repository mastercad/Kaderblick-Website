import React, { useEffect, useState, useCallback, useRef } from 'react';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SchoolIcon from '@mui/icons-material/School';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Pagination,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AdminPageLayout, AdminEmptyState, AdminSnackbar } from '../components/AdminPageLayout';
import { apiJson, apiRequest } from '../utils/api';
import { WatchlistEntry } from '../types/watchlist';

const PAGE_SIZE = 10;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: number;
  name: string;
  currentClub: string | null;
  isWatched: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

const Watchlist = () => {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<AdminSnackbar>({ open: false, message: '', severity: 'success' });

  // Search within own watchlist
  const [filterQuery, setFilterQuery] = useState('');

  // Pagination
  const [page, setPage] = useState(1);

  // Add dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{ watchlist: WatchlistEntry[] }>('/api/watchlist');
      setEntries(res?.watchlist ?? []);
    } catch {
      setError('Beobachtungsliste konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/watchlist/${id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== id));
      setSnackbar({ open: true, message: 'Aus Beobachtungsliste entfernt.', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Entfernen.', severity: 'error' });
    }
  };

  const handleToggleAnonymous = async (entry: WatchlistEntry) => {
    try {
      await apiRequest(`/api/watchlist/${entry.id}`, {
        method: 'PATCH',
        body: { isAnonymous: !entry.isAnonymous },
      });
      setEntries(prev =>
        prev.map(e => (e.id === entry.id ? { ...e, isAnonymous: !e.isAnonymous } : e))
      );
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Speichern.', severity: 'error' });
    }
  };

  const handleAddEntry = (newEntry: WatchlistEntry) => {
    setEntries(prev => [newEntry, ...prev]);
    setSnackbar({ open: true, message: 'Zur Beobachtungsliste hinzugefügt.', severity: 'success' });
  };

  // Filter entries by name
  const filtered = filterQuery.trim()
    ? entries.filter(e => {
        const name = e.type === 'player'
          ? `${e.player?.firstName ?? ''} ${e.player?.lastName ?? ''}`
          : `${e.coach?.firstName ?? ''} ${e.coach?.lastName ?? ''}`;
        return name.toLowerCase().includes(filterQuery.toLowerCase());
      })
    : entries;

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [filterQuery]);

  return (
    <AdminPageLayout
      title="Beobachtungsliste"
      icon={<BookmarkBorderIcon />}
      itemCount={entries.length}
      loading={loading}
      error={error}
      snackbar={snackbar}
      onSnackbarClose={() => setSnackbar(s => ({ ...s, open: false }))}
    >
      {/* ── Sticky toolbar: search + add button ─────────────────────────── */}
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          mb: 2,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1,
          alignItems: { xs: 'stretch', sm: 'center' },
        }}
      >
        <TextField
          size="small"
          placeholder="In Liste suchen..."
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
          sx={{ flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
          size="small"
          sx={{ whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }}
        >
          Hinzufügen
        </Button>
      </Paper>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {entries.length === 0 && !loading ? (
        <AdminEmptyState
          icon={<BookmarkBorderIcon />}
          title="Beobachtungsliste ist leer"
          createLabel="Ersten Eintrag hinzufügen"
          onCreate={() => setAddDialogOpen(true)}
        />
      ) : filtered.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
          Kein Eintrag gefunden.
        </Typography>
      ) : (
        <>
          <Stack spacing={2} sx={{ px: { xs: 0, sm: 1 } }}>
            {pagedEntries.map(entry => (
              <WatchlistCard
                key={entry.id}
                entry={entry}
                onDelete={handleDelete}
                onToggleAnonymous={handleToggleAnonymous}
              />
            ))}
          </Stack>

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
                size="small"
              />
            </Box>
          )}
        </>
      )}

      {/* ── Add dialog ───────────────────────────────────────────────────── */}
      <AddToWatchlistDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdded={handleAddEntry}
        existingEntries={entries}
        onSnackbar={msg => setSnackbar({ open: true, message: msg, severity: 'error' })}
      />
    </AdminPageLayout>
  );
};

// ── Card component ────────────────────────────────────────────────────────────

interface WatchlistCardProps {
  entry: WatchlistEntry;
  onDelete: (id: number) => void;
  onToggleAnonymous: (entry: WatchlistEntry) => void;
}

const WatchlistCard = ({ entry, onDelete, onToggleAnonymous }: WatchlistCardProps) => {
  const isPlayer = entry.type === 'player';
  const name = isPlayer
    ? `${entry.player?.firstName} ${entry.player?.lastName}`
    : `${entry.coach?.firstName} ${entry.coach?.lastName}`;

  const currentClub = isPlayer
    ? entry.player?.clubAssignments?.find(a => !a.endDate)?.club?.name
    : entry.coach?.clubAssignments?.find(a => !a.endDate)?.club?.name;

  const endingClub = isPlayer
    ? entry.player?.clubAssignments?.find(a => a.endDate)
    : entry.coach?.clubAssignments?.find(a => a.endDate);

  const stats = entry.player?.stats;

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          {/* Left: info */}
          <Stack spacing={0.5} sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
              {isPlayer ? (
                <SportsSoccerIcon fontSize="small" color="action" sx={{ flexShrink: 0 }} />
              ) : (
                <SchoolIcon fontSize="small" color="action" sx={{ flexShrink: 0 }} />
              )}
              <Typography variant="subtitle1" fontWeight="bold" sx={{ wordBreak: 'break-word', minWidth: 0 }}>
                {name}
              </Typography>
              <Chip
                label={isPlayer ? 'Spieler' : 'Trainer'}
                size="small"
                color={isPlayer ? 'primary' : 'secondary'}
                variant="outlined"
              />
            </Stack>

            {currentClub ? (
              <Typography variant="body2" color="text.secondary">
                Aktuell bei: <strong>{currentClub}</strong>
              </Typography>
            ) : (
              <Typography variant="body2" color="warning.main" fontWeight="bold">
                Vereinslos
              </Typography>
            )}

            {endingClub && (
              <Typography variant="body2" color="warning.main">
                Vereinszugehörigkeit bei <strong>{endingClub.club?.name}</strong> endet{' '}
                {endingClub.endDate ? new Date(endingClub.endDate).toLocaleDateString('de-DE') : ''}
              </Typography>
            )}

            {stats && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row" spacing={{ xs: 1, sm: 2 }} flexWrap="wrap" useFlexGap>
                  <Typography variant="caption" color="text.secondary">
                    Spiele: <strong>{stats.totalGames}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Minuten: <strong>{stats.totalMinutesPlayed}</strong>
                  </Typography>
                  {stats.eventCounts.slice(0, 4).map(ec => (
                    <Typography key={ec.type} variant="caption" color="text.secondary">
                      {ec.type}: <strong>{ec.count}</strong>
                    </Typography>
                  ))}
                </Stack>
              </>
            )}

            <Typography variant="caption" color="text.disabled">
              Hinzugefügt: {new Date(entry.createdAt).toLocaleDateString('de-DE')}
            </Typography>
          </Stack>

          {/* Right: actions */}
          <Stack direction="row" alignItems="center" sx={{ flexShrink: 0 }}>
            <Tooltip title={entry.isAnonymous ? 'Anonym beobachten (aktiv)' : 'Sichtbar beobachten (aktiv)'}>
              <IconButton size="small" onClick={() => onToggleAnonymous(entry)}>
                {entry.isAnonymous ? (
                  <VisibilityOffIcon fontSize="small" />
                ) : (
                  <VisibilityIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Aus Beobachtungsliste entfernen">
              <IconButton size="small" color="error" onClick={() => onDelete(entry.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ── Add-to-watchlist dialog ───────────────────────────────────────────────────

interface AddToWatchlistDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: (entry: WatchlistEntry) => void;
  existingEntries: WatchlistEntry[];
  onSnackbar: (msg: string) => void;
}

const AddToWatchlistDialog = ({
  open,
  onClose,
  onAdded,
  existingEntries,
  onSnackbar,
}: AddToWatchlistDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [type, setType] = useState<'player' | 'coach'>('player');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (open) { setQuery(''); setResults([]); }
  }, [open]);

  const doSearch = useCallback(async (q: string, t: 'player' | 'coach') => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await apiJson<{ results: SearchResult[] }>(
        `/api/watchlist/search?q=${encodeURIComponent(q)}&type=${t}`
      );
      setResults(res?.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value, type), 300);
  };

  const handleTypeChange = (_: React.MouseEvent<HTMLElement>, newType: 'player' | 'coach' | null) => {
    if (!newType) return;
    setType(newType);
    setResults([]);
    if (query.trim().length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(query, newType), 300);
    }
  };

  const handleAdd = async (result: SearchResult) => {
    try {
      const res = await apiJson<{ watchlist: WatchlistEntry[] }>('/api/watchlist');
      const existing = (res?.watchlist ?? []).find(
        e => e.type === type && (type === 'player' ? e.player?.id : e.coach?.id) === result.id
      );
      if (existing) {
        onSnackbar('Bereits auf der Beobachtungsliste.');
        return;
      }
      const created = await apiJson<{ id: number }>('/api/watchlist', {
        method: 'POST',
        body: { type, targetId: result.id },
      });
      // Reload full entry to get complete data
      const updated = await apiJson<{ watchlist: WatchlistEntry[] }>('/api/watchlist');
      const newEntry = (updated?.watchlist ?? []).find(e => e.id === created.id);
      if (newEntry) onAdded(newEntry);
      // Mark as watched in results
      setResults(prev => prev.map(r => r.id === result.id ? { ...r, isWatched: true } : r));
    } catch {
      onSnackbar('Fehler beim Hinzufügen.');
    }
  };

  const handleRemove = async (result: SearchResult) => {
    try {
      const res = await apiJson<{ watchlist: WatchlistEntry[] }>('/api/watchlist');
      const entry = (res?.watchlist ?? []).find(
        e => e.type === type && (type === 'player' ? e.player?.id : e.coach?.id) === result.id
      );
      if (entry) {
        await apiRequest(`/api/watchlist/${entry.id}`, { method: 'DELETE' });
      }
      setResults(prev => prev.map(r => r.id === result.id ? { ...r, isWatched: false } : r));
    } catch {
      onSnackbar('Fehler beim Entfernen.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        Spieler oder Trainer beobachten
        <IconButton size="small" onClick={onClose} edge="end" aria-label="Schließen">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
        <Stack spacing={2} mt={0.5}>
          <ToggleButtonGroup
            value={type}
            exclusive
            onChange={handleTypeChange}
            size="small"
          >
            <ToggleButton value="player">
              <SportsSoccerIcon fontSize="small" sx={{ mr: 0.5 }} /> Spieler
            </ToggleButton>
            <ToggleButton value="coach">
              <SchoolIcon fontSize="small" sx={{ mr: 0.5 }} /> Trainer
            </ToggleButton>
          </ToggleButtonGroup>

          <TextField
            autoFocus
            size="small"
            fullWidth
            placeholder={type === 'player' ? 'Spielername suchen...' : 'Trainername suchen...'}
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {searching ? <CircularProgress size={16} /> : <SearchIcon fontSize="small" />}
                </InputAdornment>
              ),
            }}
          />

          {results.length > 0 && (
            <List dense disablePadding>
              {results.map(result => (
                <ListItemButton
                  key={result.id}
                  divider
                  disableRipple
                  sx={{ pr: 7 }}
                >
                  <ListItemText
                    primary={result.name}
                    secondary={result.currentClub ?? 'Vereinslos'}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title={result.isWatched ? 'Beobachtung beenden' : 'Beobachten'}>
                      <IconButton
                        size="small"
                        color={result.isWatched ? 'primary' : 'default'}
                        onClick={() => result.isWatched ? handleRemove(result) : handleAdd(result)}
                      >
                        {result.isWatched
                          ? <BookmarkIcon fontSize="small" />
                          : <BookmarkBorderIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItemButton>
              ))}
            </List>
          )}

          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Keine Ergebnisse.
            </Typography>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default Watchlist;
