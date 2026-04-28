import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorIcon from '@mui/icons-material/Error';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';
import SportsIcon from '@mui/icons-material/Sports';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { apiJson, getApiErrorMessage } from '../../../utils/api';
import { formatDateTime } from './formatters';
import SummaryCard from './SummaryCard';
import type { GameFilter, GameStatsEntry, GameStatsPagination, GameStatsSummary } from './types';

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function GameStatsTab() {
  const [summary, setSummary]           = useState<GameStatsSummary | null>(null);
  const [games, setGames]               = useState<GameStatsEntry[]>([]);
  const [pagination, setPagination]     = useState<GameStatsPagination>({ page: 1, perPage: 25, total: 0, totalPages: 0 });
  const [loading, setLoading]           = useState(true);
  const [recalcingAll, setRecalcingAll] = useState(false);
  const [recalcingId, setRecalcingId]   = useState<number | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [successMsg, setSuccessMsg]     = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<GameFilter>('withoutStats');
  const [page, setPage]                 = useState(0);   // MUI: 0-based
  const [perPage, setPerPage]           = useState(25);

  const load = useCallback(async (filter: GameFilter, p: number, pp: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ summary: GameStatsSummary; games: GameStatsEntry[]; pagination: GameStatsPagination }>(
        `/api/admin/system/game-stats?filter=${filter}&page=${p + 1}&perPage=${pp}`
      );
      setSummary(data.summary);
      setGames(data.games);
      setPagination(data.pagination);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(activeFilter, page, perPage); }, [load, activeFilter, page, perPage]);

  const handleRecalcAll = async () => {
    setRecalcingAll(true);
    setError(null);
    try {
      const result = await apiJson<{ processed: number; failed: number; message?: string }>(
        '/api/admin/system/recalc-all',
        { method: 'POST' }
      );
      setSuccessMsg(
        result.message ??
        `${result.processed} Spiele verarbeitet${result.failed > 0 ? `, ${result.failed} Fehler` : ''}.`
      );
      await load(activeFilter, page, perPage);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setRecalcingAll(false);
    }
  };

  const handleRecalcSingle = async (id: number) => {
    setRecalcingId(id);
    setError(null);
    try {
      await apiJson(`/api/admin/system/recalc/${id}`, { method: 'POST' });
      setSuccessMsg(`Stats für Spiel #${id} erfolgreich neu berechnet.`);
      await load(activeFilter, page, perPage);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setRecalcingId(null);
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

  const handleChangePerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (filter: GameFilter) => {
    setActiveFilter(filter);
    setPage(0);
  };

  const inconsistentCount = summary?.withoutStats ?? 0;

  return (
    <Box>
      {summary && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 3 }}>
          <SummaryCard
            label="Spiele gesamt"
            value={summary.total}
            color="default"
            icon={<SportsIcon fontSize="small" />}
            active={activeFilter === 'all'}
            onClick={() => handleFilterChange('all')}
          />
          <SummaryCard
            label="Mit Stats"
            value={summary.withStats}
            color="success"
            icon={<CheckCircleOutlineIcon fontSize="small" />}
            active={activeFilter === 'withStats'}
            onClick={() => handleFilterChange('withStats')}
          />
          <SummaryCard
            label="Fehlende Stats"
            value={summary.withoutStats}
            color={summary.withoutStats > 0 ? 'error' : 'default'}
            icon={summary.withoutStats > 0 ? <ErrorIcon fontSize="small" /> : <QueryStatsIcon fontSize="small" />}
            active={activeFilter === 'withoutStats'}
            onClick={() => handleFilterChange('withoutStats')}
          />
          <SummaryCard
            label="Ohne Aufstellung"
            value={summary.noMatchPlan}
            color={summary.noMatchPlan > 0 ? 'warning' : 'default'}
            icon={<WarningAmberIcon fontSize="small" />}
            active={activeFilter === 'noMatchPlan'}
            onClick={() => handleFilterChange('noMatchPlan')}
          />
        </Box>
      )}

      {error      && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Button
          variant="contained"
          color="warning"
          startIcon={recalcingAll ? <CircularProgress size={16} color="inherit" /> : <ReplayIcon />}
          onClick={handleRecalcAll}
          disabled={recalcingAll || inconsistentCount === 0}
        >
          {inconsistentCount > 0 ? `${inconsistentCount} Spiele neu berechnen` : 'Alle Stats aktuell'}
        </Button>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={() => load(activeFilter, page, perPage)} disabled={loading} size="small">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : games.length === 0 ? (
        <Alert severity="success">
          {activeFilter === 'withoutStats'
            ? 'Alle Spielstatistiken sind aktuell!'
            : 'Keine Spiele für diesen Filter gefunden.'
          }
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Spiel</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Datum</TableCell>
                <TableCell>Ergebnis</TableCell>
                <TableCell align="center">Stats</TableCell>
                <TableCell align="center" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Aufstellung</TableCell>
                <TableCell align="center">Aktion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {games.map((g) => (
                <TableRow key={g.id} sx={g.isInconsistent ? { bgcolor: 'error.50' } : undefined}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={g.isInconsistent ? 700 : 400}>
                      {g.homeTeam ?? '?'} vs. {g.awayTeam ?? '?'}
                    </Typography>
                    {g.matchDay && (
                      <Typography variant="caption" color="text.secondary">{g.matchDay}</Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
                      {formatDateTime(g.scheduledAt)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    <Typography variant="body2">{formatDateTime(g.scheduledAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    {g.homeScore !== null && g.awayScore !== null ? `${g.homeScore}:${g.awayScore}` : '–'}
                  </TableCell>
                  <TableCell align="center">
                    {g.statsCount > 0
                      ? <Chip label={g.statsCount} size="small" color="success" />
                      : g.hasMatchPlan
                        ? <Chip icon={<ErrorIcon />} label="Fehlt" size="small" color="error" />
                        : <Chip label="–" size="small" />
                    }
                  </TableCell>
                  <TableCell align="center" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    {g.hasMatchPlan
                      ? <Chip label="Vorhanden" size="small" color="success" variant="outlined" />
                      : <Chip label="Fehlt" size="small" variant="outlined" />
                    }
                  </TableCell>
                  <TableCell align="center">
                    {g.hasMatchPlan && (
                      <Tooltip title="Stats neu berechnen">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleRecalcSingle(g.id)}
                            disabled={recalcingId === g.id}
                          >
                            {recalcingId === g.id
                              ? <CircularProgress size={16} />
                              : <ReplayIcon fontSize="small" />
                            }
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={pagination.total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={perPage}
            onRowsPerPageChange={handleChangePerPage}
            rowsPerPageOptions={PER_PAGE_OPTIONS}
            labelRowsPerPage="Pro Seite:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} von ${count}`}
            sx={{ '& .MuiTablePagination-selectLabel': { display: { xs: 'none', sm: 'block' } } }}
          />
        </TableContainer>
      )}
    </Box>
  );
}
