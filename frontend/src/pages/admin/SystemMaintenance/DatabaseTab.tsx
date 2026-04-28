import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import { apiJson, apiRequest, getApiErrorMessage } from '../../../utils/api';
import { formatBytes, formatDateTime } from './formatters';
import type { Backup } from './types';

export default function DatabaseTab() {
  const [backups, setBackups]           = useState<Backup[]>([]);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [downloading, setDownloading]   = useState<string | null>(null);
  const [restoring, setRestoring]       = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);  const [confirmDelete, setConfirmDelete]   = useState<string | null>(null);
  const [deleting, setDeleting]             = useState<string | null>(null);  const [dragging, setDragging]         = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [successMsg, setSuccessMsg]     = useState<string | null>(null);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ backups: Backup[] }>('/api/admin/system/backups');
      setBackups(data.backups);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  // ── Backup erstellen ────────────────────────────────────────────────────────

  const handleCreateBackup = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await apiJson<{ filename: string; size: number }>(
        '/api/admin/system/backup',
        { method: 'POST' }
      );
      setSuccessMsg(`Backup erstellt: ${result.filename} (${formatBytes(result.size)})`);
      await loadBackups();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  // ── Herunterladen ───────────────────────────────────────────────────────────

  const handleDownload = async (filename: string) => {
    setDownloading(filename);
    setError(null);
    try {
      const response = await apiRequest(
        `/api/admin/system/backup/download/${encodeURIComponent(filename)}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Download fehlgeschlagen.'));
    } finally {
      setDownloading(null);
    }
  };

  // ── Hochladen (Drag & Drop oder Dateiauswahl) ───────────────────────────────

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.sql')) {
      setError('Nur .sql-Dateien werden akzeptiert.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiJson<{ filename: string; size: number }>(
        '/api/admin/system/backup/upload',
        { method: 'POST', body: formData }
      );
      setSuccessMsg(`Backup "${result.filename}" hochgeladen (${formatBytes(result.size)}).`);
      await loadBackups();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  // ── Löschen ─────────────────────────────────────────────────────────────────

  const handleDelete = async (filename: string) => {
    setDeleting(filename);
    setConfirmDelete(null);
    setError(null);
    try {
      await apiJson(`/api/admin/system/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      setSuccessMsg(`Backup "${filename}" gelöscht.`);
      await loadBackups();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setDeleting(null);
    }
  };

  // ── Wiederherstellen ────────────────────────────────────────────────────────

  const handleRestore = async (filename: string) => {
    setRestoring(filename);
    setConfirmRestore(null);
    setError(null);
    try {
      const result = await apiJson<{ message: string }>(
        `/api/admin/system/backup/restore/${encodeURIComponent(filename)}`,
        { method: 'POST' }
      );
      setSuccessMsg(result.message);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Box>
      {error      && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      {/* ── Backup erstellen ── */}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Neues Backup erstellen
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Erstellt einen vollständigen MySQL-Dump der gesamten Datenbank (mysqldump).
          Je nach Datenbankgröße kann dies einige Sekunden dauern.
        </Typography>
        <Button
          variant="contained"
          startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleCreateBackup}
          disabled={creating}
        >
          {creating ? 'Backup wird erstellt …' : 'Backup jetzt erstellen'}
        </Button>
      </Paper>

      {/* ── Backup hochladen ── */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 3,
          borderStyle: 'dashed',
          borderColor: dragging ? 'primary.main' : 'divider',
          bgcolor: dragging ? 'action.hover' : 'transparent',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s, background-color 0.2s',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        aria-label="Backup hochladen"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".sql"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          data-testid="backup-file-input"
        />
        {uploading ? (
          <CircularProgress size={28} />
        ) : (
          <>
            <CloudUploadIcon color="action" sx={{ fontSize: 36, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              .sql-Datei hier ablegen oder klicken zur Dateiauswahl
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Backup wird in die Liste aufgenommen und kann danach wiederhergestellt werden.
            </Typography>
          </>
        )}
      </Paper>

      {/* ── Vorhandene Backups ── */}
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Vorhandene Backups
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : backups.length === 0 ? (
        <Alert severity="info">Noch keine Backups vorhanden.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Dateiname</TableCell>
                <TableCell>Erstellt am</TableCell>
                <TableCell align="right">Größe</TableCell>
                <TableCell align="center">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {backups.map((b) => (
                <TableRow key={b.filename}>
                  <TableCell sx={{ maxWidth: { xs: 140, sm: 'none' } }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-word' }}>
                      {b.filename}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDateTime(b.createdAt)}</TableCell>
                  <TableCell align="right">{formatBytes(b.size)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Herunterladen">
                      <span>
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label="Herunterladen"
                          onClick={() => handleDownload(b.filename)}
                          disabled={downloading === b.filename || restoring !== null}
                        >
                          {downloading === b.filename
                            ? <CircularProgress size={16} />
                            : <CloudDownloadIcon fontSize="small" />
                          }
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Datenbank wiederherstellen">
                      <span>
                        <IconButton
                          size="small"
                          color="warning"
                          aria-label="Wiederherstellen"
                          onClick={() => setConfirmRestore(b.filename)}
                          disabled={restoring !== null || downloading !== null || deleting !== null}
                        >
                          {restoring === b.filename
                            ? <CircularProgress size={16} />
                            : <RestoreIcon fontSize="small" />
                          }
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Löschen">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label="Löschen"
                          onClick={() => setConfirmDelete(b.filename)}
                          disabled={deleting !== null || restoring !== null || downloading !== null}
                        >
                          {deleting === b.filename
                            ? <CircularProgress size={16} />
                            : <DeleteIcon fontSize="small" />
                          }
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Stack direction="row" sx={{ mt: 1 }}>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={loadBackups} disabled={loading} size="small">
          <RefreshIcon />
        </IconButton>
      </Stack>

      {/* ── Bestätigungs-Dialog Löschen ── */}
      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Backup löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Das Backup <strong>{confirmDelete}</strong> wird unwiderruflich gelöscht.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Abbrechen</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => confirmDelete && handleDelete(confirmDelete)}
          >
            Löschen
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bestätigungs-Dialog Wiederherstellen ── */}
      <Dialog open={confirmRestore !== null} onClose={() => setConfirmRestore(null)}>
        <DialogTitle>Datenbank wiederherstellen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Das Backup <strong>{confirmRestore}</strong> wird eingespielt. Alle aktuellen Daten
            werden dabei unwiderruflich überschrieben.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRestore(null)}>Abbrechen</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => confirmRestore && handleRestore(confirmRestore)}
          >
            Wiederherstellen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
