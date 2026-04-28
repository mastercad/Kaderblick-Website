import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopIcon from '@mui/icons-material/Stop';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { apiJson, getApiErrorMessage } from '../../../utils/api';
import CronStatusChip from './CronStatusChip';
import { formatDateTime, formatDuration } from './formatters';
import type { CronJob } from './types';

export default function CronJobsTab() {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [jobs, setJobs]                 = useState<CronJob[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [localRunning, setLocalRunning] = useState<string | null>(null);
  const [runMsg, setRunMsg]             = useState<{ ok: boolean; text: string } | null>(null);
  const [errorModalJob, setErrorModalJob] = useState<CronJob | null>(null);

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
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Command</TableCell>
                <TableCell>Letzter Lauf</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Alter</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Max. Intervall</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => {
                const isProblematic = job.status === 'error' || job.status === 'late' || !!job.lastError;
                const rowBg = job.status === 'error' || !!job.lastError ? 'error.50' : job.status === 'late' ? 'warning.50' : undefined;
                return (
                <TableRow key={job.command} sx={rowBg ? { bgcolor: rowBg } : undefined}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{job.label}</Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
                      {job.command}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDateTime(job.lastRunAt)}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{formatDuration(job.ageMinutes)}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
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
                      {isProblematic && (
                        <Tooltip title={job.status === 'late' ? 'Überfällig – Details anzeigen' : 'Fehler anzeigen'}>
                          <IconButton
                            size="small"
                            color={job.status === 'late' && !job.lastError ? 'warning' : 'error'}
                            aria-label={`Details: ${job.label}`}
                            onClick={() => setErrorModalJob(job)}
                          >
                            {job.status === 'late' && !job.lastError
                              ? <WarningAmberIcon fontSize="small" />
                              : <ErrorOutlineIcon fontSize="small" />
                            }
                          </IconButton>
                        </Tooltip>
                      )}
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
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Fehler-Detail-Modal ── */}
      <Dialog
        open={errorModalJob !== null}
        onClose={() => setErrorModalJob(null)}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreen}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
          {errorModalJob?.status === 'late' && !errorModalJob?.lastError
            ? <WarningAmberIcon color="warning" fontSize="small" />
            : <ErrorOutlineIcon color="error" fontSize="small" />
          }
          <Box sx={{ flex: 1 }}>{errorModalJob?.label}</Box>
          <IconButton size="small" onClick={() => setErrorModalJob(null)} aria-label="Schließen">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                Command
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', bgcolor: 'action.hover', px: 1.5, py: 1, borderRadius: 1 }}>
                {errorModalJob?.command}
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                Status
              </Typography>
              {errorModalJob && <CronStatusChip status={errorModalJob.status} />}
            </Box>

            {errorModalJob?.lastRunAt && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                  Letzter Lauf
                </Typography>
                <Typography variant="body2">{formatDateTime(errorModalJob.lastRunAt)}</Typography>
              </Box>
            )}

            {errorModalJob?.maxAgeMin != null && errorModalJob.ageMinutes != null && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                  Überfällig seit
                </Typography>
                <Typography variant="body2" color="warning.main" fontWeight={600}>
                  {formatDuration(errorModalJob.ageMinutes)} (Max: {formatDuration(errorModalJob.maxAgeMin)})
                </Typography>
              </Box>
            )}

            {errorModalJob?.lastError ? (
              <>
                <Divider />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                    Fehlermeldung
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      bgcolor: 'error.50',
                      borderColor: 'error.light',
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="error.main"
                      sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {errorModalJob.lastError}
                    </Typography>
                  </Paper>
                </Box>
              </>
            ) : (
              <>
                <Divider />
                <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />}>
                  Der Job hat seit länger als erwartet keinen Heartbeat gesendet. Möglicherweise läuft er nicht oder hängt.
                  Starte ihn manuell und prüfe die Logs.
                </Alert>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrorModalJob(null)}>Schließen</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
