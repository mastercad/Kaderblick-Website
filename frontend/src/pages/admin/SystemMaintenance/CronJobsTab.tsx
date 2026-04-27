import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopIcon from '@mui/icons-material/Stop';
import { apiJson, getApiErrorMessage } from '../../../utils/api';
import CronStatusChip from './CronStatusChip';
import { formatDateTime, formatDuration } from './formatters';
import type { CronJob } from './types';

export default function CronJobsTab() {
  const [jobs, setJobs]                 = useState<CronJob[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [localRunning, setLocalRunning] = useState<string | null>(null);
  const [runMsg, setRunMsg]             = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ jobs: CronJob[] }>('/api/admin/system/cron-status');
      setJobs(data.jobs);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-poll jede 2 Sekunden solange ein Job läuft
  useEffect(() => {
    if (!jobs.some(j => j.running)) return;
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [jobs, load]);

  const handleRun = async (command: string) => {
    setLocalRunning(command);
    setRunMsg(null);
    try {
      await apiJson('/api/admin/system/cron/run', {
        method: 'POST',
        body: { command },
      });
      setRunMsg({ ok: true, text: 'Job gestartet.' });
      await load();
    } catch (e) {
      const errData = (e as { data?: { error?: string } })?.data;
      setRunMsg({ ok: false, text: errData?.error ?? getApiErrorMessage(e) });
      await load();
    } finally {
      setLocalRunning(null);
    }
  };

  const handleKill = async (command: string) => {
    setRunMsg(null);
    try {
      await apiJson('/api/admin/system/cron/kill', {
        method: 'POST',
        body: { command },
      });
      setRunMsg({ ok: true, text: 'Job wird gestoppt.' });
      await load();
    } catch (e) {
      setRunMsg({ ok: false, text: getApiErrorMessage(e) });
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Heartbeat-Status aller bekannten Cron-Jobs. Status basiert auf dem letzten gespeicherten Heartbeat.
        </Typography>
        <IconButton onClick={load} disabled={loading} size="small">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {runMsg && (
        <Alert severity={runMsg.ok ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setRunMsg(null)}>
          {runMsg.text}
        </Alert>
      )}

      {loading && jobs.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job</TableCell>
                <TableCell>Command</TableCell>
                <TableCell>Letzter Lauf</TableCell>
                <TableCell>Alter</TableCell>
                <TableCell>Max. Intervall</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.command} sx={job.lastError ? { bgcolor: 'error.50' } : undefined}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{job.label}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
                      {job.command}
                    </Typography>
                    {job.lastError && (
                      <Typography
                        variant="caption"
                        color="error.main"
                        sx={{ display: 'block', whiteSpace: 'pre-wrap', mt: 0.5, maxWidth: 400, wordBreak: 'break-word' }}
                      >
                        {job.lastError}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{formatDateTime(job.lastRunAt)}</TableCell>
                  <TableCell>{formatDuration(job.ageMinutes)}</TableCell>
                  <TableCell>
                    {job.maxAgeMin !== null
                      ? formatDuration(job.maxAgeMin)
                      : <Typography variant="caption" color="text.secondary">manuell</Typography>
                    }
                  </TableCell>
                  <TableCell align="center">
                    <CronStatusChip status={job.status} />
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" justifyContent="center" spacing={0.5}>
                      <Tooltip title="Jetzt ausführen">
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            aria-label={`Ausführen: ${job.command}`}
                            onClick={() => handleRun(job.command)}
                            disabled={job.running || localRunning !== null}
                          >
                            {localRunning === job.command
                              ? <CircularProgress size={16} />
                              : <PlayArrowIcon fontSize="small" />
                            }
                          </IconButton>
                        </span>
                      </Tooltip>
                      {job.running && (
                        <Tooltip title="Job stoppen">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={`Stoppen: ${job.command}`}
                              onClick={() => handleKill(job.command)}
                            >
                              <StopIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
