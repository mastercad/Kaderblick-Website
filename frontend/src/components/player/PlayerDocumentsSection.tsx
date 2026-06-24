import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, IconButton, InputLabel, List, ListItem, ListItemText,
  MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { apiBlob, apiJson, getApiErrorMessage } from '../../utils/api';

type Club = { id: number; name: string };
export type PlayerDocument = {
  id: number; displayName: string; category: string; originalFilename: string; mimeType: string;
  fileSize: number; issuedAt: string | null; expiresAt: string | null; notes: string | null;
  ocrDetected: boolean; createdAt: string; club: Club; canManage: boolean;
  processingStatus?: 'pending' | 'processing' | 'ready' | 'failed'; processingError?: string | null;
};
type Response = { documents: PlayerDocument[]; canManage: boolean; clubs: Club[] };

const labels: Record<string, string> = { auto: 'Automatisch erkennen', pass: 'Pass / Ausweis', medical: 'Medizinisch', consent: 'Einverständnis', contract: 'Vertrag', other: 'Sonstiges' };

export default function PlayerDocumentsSection({ playerId }: { playerId: number }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [clubId, setClubId] = useState<number | ''>('');
  const [category, setCategory] = useState('auto');
  const [displayName, setDisplayName] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiJson<Response>(`/api/players/${playerId}/documents`);
      const normalized: Response = {
        documents: Array.isArray(result?.documents) ? result.documents : [],
        clubs: Array.isArray(result?.clubs) ? result.clubs : [],
        canManage: result?.canManage === true,
      };
      setData(normalized); setClubId(normalized.clubs.length === 1 ? normalized.clubs[0].id : ''); setError(null);
    } catch (e) { setError(getApiErrorMessage(e, 'Dokumente konnten nicht geladen werden.')); }
    finally { setLoading(false); }
  }, [playerId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!data?.documents.some(document => document.processingStatus === 'pending' || document.processingStatus === 'processing')) return;
    const timer = window.setTimeout(() => void load(), 3000);
    return () => window.clearTimeout(timer);
  }, [data, load]);

  const upload = async () => {
    if (!file || !clubId) { setError('Bitte Datei und Verein auswählen.'); return; }
    setSaving(true); setError(null);
    const body = new FormData(); body.append('file', file); body.append('clubId', String(clubId)); body.append('category', category);
    if (displayName) body.append('displayName', displayName); if (issuedAt) body.append('issuedAt', issuedAt);
    if (expiresAt) body.append('expiresAt', expiresAt); if (notes) body.append('notes', notes);
    try {
      await apiJson(`/api/players/${playerId}/documents`, { method: 'POST', body });
      setOpen(false); setFile(null); setDisplayName(''); setIssuedAt(''); setExpiresAt(''); setNotes(''); setCategory('auto'); await load();
    } catch (e) { setError(getApiErrorMessage(e, 'Upload fehlgeschlagen.')); }
    finally { setSaving(false); }
  };
  const download = async (document: PlayerDocument) => {
    try {
      const blob = await apiBlob(`/api/player-documents/${document.id}/content`); const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a'); link.href = url; link.download = document.originalFilename; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(getApiErrorMessage(e, 'Dokument konnte nicht geöffnet werden.')); }
  };
  const remove = async (document: PlayerDocument) => {
    if (!window.confirm(`„${document.displayName}“ wirklich löschen?`)) return;
    try { await apiJson(`/api/player-documents/${document.id}`, { method: 'DELETE' }); await load(); }
    catch (e) { setError(getApiErrorMessage(e, 'Löschen fehlgeschlagen.')); }
  };

  if (loading) return <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={24} /></Box>;
  if (!data && error) return <Alert severity="error">{error}</Alert>;
  return <Box>
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Dokumente</Typography>
      {data?.canManage && <Button size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Hochladen</Button>}
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
    {!data?.documents?.length ? <Typography variant="body2" color="text.secondary">Keine zugänglichen Dokumente vorhanden</Typography> :
      <List dense disablePadding>{data.documents.map(document => <ListItem key={document.id} divider secondaryAction={<Stack direction="row">
        <Tooltip title="Öffnen"><IconButton aria-label="Dokument öffnen" onClick={() => void download(document)}><DownloadIcon /></IconButton></Tooltip>
        {document.canManage && <Tooltip title="Löschen"><IconButton aria-label="Dokument löschen" color="error" onClick={() => void remove(document)}><DeleteOutlineIcon /></IconButton></Tooltip>}
      </Stack>}>
        <DescriptionIcon sx={{ mr: 2 }} color="action" />
        <ListItemText primary={<Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}><span>{document.displayName}</span><Chip size="small" label={labels[document.category] || document.category} />
          {(document.processingStatus === 'pending' || document.processingStatus === 'processing') && <Chip size="small" color="info" label="OCR läuft…" />}
          {document.processingStatus === 'failed' && <Chip size="small" color="error" label="Verarbeitung fehlgeschlagen" />}
          {document.ocrDetected && <Tooltip title="Per OCR erkannt"><AutoAwesomeIcon color="primary" fontSize="small" /></Tooltip>}</Stack>}
          secondary={`${document.club.name}${document.expiresAt ? ` · Gültig bis ${new Date(document.expiresAt + 'T00:00:00').toLocaleDateString('de-DE')}` : ''}${document.processingStatus === 'failed' && document.processingError ? ` · ${document.processingError}` : ''}`} />
      </ListItem>)}</List>}
    <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Dokument einscannen oder hochladen</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
        <Button component="label" variant="outlined">{file ? file.name : 'PDF oder Bild auswählen'}<input hidden type="file" accept="application/pdf,image/jpeg,image/png,image/webp" capture="environment" onChange={e => setFile(e.target.files?.[0] || null)} /></Button>
        <FormControl fullWidth required><InputLabel>Verein</InputLabel><Select value={clubId} label="Verein" onChange={e => setClubId(Number(e.target.value))}>{data?.clubs.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</Select></FormControl>
        <FormControl fullWidth><InputLabel>Dokumenttyp</InputLabel><Select value={category} label="Dokumenttyp" onChange={e => setCategory(e.target.value)}>{Object.entries(labels).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</Select></FormControl>
        <TextField label="Bezeichnung (optional)" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField fullWidth type="date" label="Ausgestellt am" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField fullWidth type="date" label="Gültig bis" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Stack>
        <TextField label="Notizen" multiline minRows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        <Alert severity="info">Nach dem Upload übernimmt der Worker OCR, Google-Drive-Upload sowie die automatische Erkennung von Dokumenttyp und Datumsangaben.</Alert>
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)} disabled={saving}>Abbrechen</Button><Button variant="contained" onClick={() => void upload()} disabled={saving || !file || !clubId}>{saving ? 'Wird gespeichert…' : 'Hochladen & verarbeiten'}</Button></DialogActions>
    </Dialog>
  </Box>;
}
