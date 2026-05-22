import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Card, CardContent,
  Divider, Alert, TextField, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Stack, Avatar, Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GitHubIcon from '@mui/icons-material/GitHub';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiJson } from '../utils/api';

/* ─── Types ──────────────────────────────────────────── */

interface GithubComment {
  id: number;
  body: string;
  userName: string;
  createdAt: string;
}

interface GithubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  htmlUrl: string;
  createdAt: string;
  userName: string;
  isRead: boolean;
  isResolved: boolean;
  adminNote: string | null;
  comments: GithubComment[];
}

/* ─── Helpers ────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

/* ─── ResolveDialog ──────────────────────────────────── */
function ResolveDialog({ open, onClose, onConfirm }: {
  open: boolean; onClose: () => void; onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{
      paper: { sx: { borderRadius: 3 } }
    }}>
      <DialogTitle sx={{ pr: 6 }}>
        GitHub Issue erledigen
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 12 }} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <TextField
          label="Abschluss-Notiz (optional)" multiline rows={3} fullWidth value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optionale interne Notiz — das Issue wird auf GitHub geschlossen."
        />
        <Alert severity="info" sx={{ mt: 1.5, borderRadius: 1.5 }}>
          Das GitHub Issue wird automatisch mit einem Status-Kommentar geschlossen.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Abbrechen</Button>
        <Button onClick={() => { onConfirm(note); setNote(''); }} variant="contained" color="success"
          startIcon={<CheckCircleIcon />}>
          Erledigen
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── CommentItem ────────────────────────────────────── */
function CommentItem({ c }: { c: GithubComment }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Avatar
        sx={{ width: 32, height: 32, fontSize: '0.72rem', fontWeight: 700, bgcolor: '#24292f', flexShrink: 0 }}
        src={`https://github.com/${c.userName}.png?size=64`}
      >
        {getInitials(c.userName)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: "text.primary"
            }}>{c.userName}</Typography>
          <Typography variant="caption" sx={{
            color: "text.disabled"
          }}>{fmtDate(c.createdAt)}</Typography>
          <Tooltip title="Auf GitHub ansehen">
            <Typography
              variant="caption"
              component="a"
              href={`https://github.com`}
              target="_blank"
              sx={{ ml: 'auto', color: 'text.disabled', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
            >
              <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
            </Typography>
          </Tooltip>
        </Box>
        <Box sx={{
          p: 1.25, px: 1.75,
          borderRadius: '4px 14px 14px 14px',
          bgcolor: 'grey.100',
          wordBreak: 'break-word',
          border: '1px solid',
          borderColor: 'divider',
        }}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.55 }}>{c.body}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

/* ─── Main Page ──────────────────────────────────────── */

const GithubIssueDetailPage: React.FC = () => {
  const { number } = useParams<{ number: string }>();
  const navigate   = useNavigate();
  const location   = useLocation();
  const returnTab: number = (location.state as any)?.tab ?? 0;
  const goBack = () => navigate('/admin/feedback', { state: { tab: returnTab } });

  const [issue, setIssue]         = useState<GithubIssue | null>(null);
  const [loading, setLoading]     = useState(true);
  const [text, setText]           = useState('');
  const [sending, setSending]     = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [snack, setSnack]         = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const load = useCallback(async () => {
    try {
      const data = await apiJson(`/admin/feedback/github-issue/${number}`, { method: 'GET' });
      setIssue(data);
    } catch {
      showSnack('GitHub Issue konnte nicht geladen werden.', 'error');
    } finally {
      setLoading(false);
    }
  }, [number]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [issue?.comments?.length]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !issue) return;
    setSending(true);
    try {
      const res = await apiJson(`/admin/feedback/github-issue/${number}/comment`, {
        method: 'POST', body: { content },
      });
      if (res.issue) setIssue(res.issue);
      else load();
      setText('');
      showSnack('Kommentar auf GitHub veröffentlicht.');
    } catch {
      showSnack('Kommentar konnte nicht gespeichert werden.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async (note: string) => {
    if (!issue) return;
    try {
      await apiJson(`/admin/feedback/github-issue/${number}/resolve`, {
        method: 'POST', body: { adminNote: note },
      });
      setResolveOpen(false);
      showSnack('Issue erledigt und auf GitHub geschlossen.');
      load();
    } catch {
      showSnack('Fehler beim Erledigen.', 'error');
    }
  };

  const handleReopen = async () => {
    if (!issue) return;
    try {
      await apiJson(`/admin/feedback/github-issue/${number}/reopen`, { method: 'POST' });
      showSnack('Issue wieder geöffnet.');
      load();
    } catch {
      showSnack('Fehler beim Wiedereröffnen.', 'error');
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  if (!issue) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">GitHub Issue konnte nicht geladen werden.</Typography>
        <Button onClick={goBack} sx={{ mt: 2 }} startIcon={<ArrowBackIcon />}>
          Zurück zur Übersicht
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 860, mx: 'auto' }}>
      {/* Back + header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton onClick={goBack} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: '#24292f', color: 'white', display: 'flex' }}>
          <GitHubIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" noWrap sx={{
            fontWeight: 700
          }}>
            Issue #{issue.number}
          </Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>
            {issue.userName} · {fmtDate(issue.createdAt)}
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          {!issue.isResolved && (
            <Button variant="contained" color="success" size="small" startIcon={<CheckCircleIcon />}
              onClick={() => setResolveOpen(true)}>
              Erledigen
            </Button>
          )}
          {issue.isResolved && (
            <Button variant="outlined" size="small" startIcon={<ReplayIcon />} onClick={handleReopen}>
              Wieder öffnen
            </Button>
          )}
          <Tooltip title="Auf GitHub öffnen">
            <IconButton size="small" component="a" href={issue.htmlUrl} target="_blank">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {/* Issue body card */}
      <Card elevation={0} sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: issue.isResolved ? 'success.main' : issue.isRead ? 'warning.main' : 'error.main',
        borderRadius: 2, mb: 3,
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
            <Avatar
              sx={{ width: 36, height: 36, bgcolor: '#24292f', fontSize: '0.75rem', fontWeight: 700 }}
              src={`https://github.com/${issue.userName}.png?size=72`}
            >
              {getInitials(issue.userName)}
            </Avatar>
            <Box>
              <Typography variant="body1" sx={{
                fontWeight: 700
              }}>{issue.userName}</Typography>
            </Box>
            <Chip
              icon={<GitHubIcon sx={{ fontSize: '16px !important', color: '#24292f !important' }} />}
              label="GitHub Issue"
              size="small"
              sx={{ bgcolor: '#f6f8fa', color: '#24292f', fontWeight: 600, border: '1px solid #d0d7de' }}
            />
            <Chip label={`#${issue.number}`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
            {issue.isResolved
              ? <Chip label="Erledigt"       size="small" icon={<CheckCircleIcon />} color="success" sx={{ fontWeight: 600 }} />
              : issue.isRead
                ? <Chip label="In Bearbeitung" size="small" color="warning" sx={{ fontWeight: 600 }} />
                : <Chip label="Neu"            size="small" color="error"   sx={{ fontWeight: 600 }} />}
          </Box>

          {/* Title */}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              mb: 1.5,
              wordBreak: 'break-word'
            }}>
            {issue.title}
          </Typography>

          {/* Body */}
          {issue.body && (
            <Typography variant="body1" sx={{ mb: 1.5, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
              {issue.body}
            </Typography>
          )}

          {issue.adminNote && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#e8f5e9', borderRadius: 1.5, borderLeft: '3px solid', borderLeftColor: 'success.main' }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: "success.dark"
                }}>Abschluss-Notiz:</Typography>
              <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                {issue.adminNote}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
      {/* Comments + reply */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <CardContent>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              mb: 2
            }}>
            GitHub-Kommentare
            {issue.comments.length > 0 && (
              <Typography
                component="span"
                variant="body2"
                sx={{
                  color: "text.secondary",
                  ml: 1
                }}>
                ({issue.comments.length})
              </Typography>
            )}
          </Typography>

          {issue.comments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3, color: 'text.disabled' }}>
              <Typography variant="body2">Noch keine Kommentare auf GitHub.</Typography>
            </Box>
          ) : (
            <Stack spacing={2} sx={{ mb: 2.5 }}>
              {issue.comments.map(c => <CommentItem key={c.id} c={c} />)}
              <div ref={bottomRef} />
            </Stack>
          )}

          <Divider sx={{ mb: 2 }} />

          {/* Reply input */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              multiline maxRows={6} size="small" fullWidth
              placeholder="Kommentar auf GitHub schreiben… (Strg+Enter senden)"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSend(); } }}
              disabled={sending}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Tooltip title="Auf GitHub kommentieren (Strg+Enter)">
              <span>
                <Button
                  variant="contained" onClick={handleSend}
                  disabled={!text.trim() || sending}
                  endIcon={<SendIcon />}
                  sx={{ flexShrink: 0, minWidth: 100, bgcolor: '#24292f', '&:hover': { bgcolor: '#444' } }}
                >
                  Senden
                </Button>
              </span>
            </Tooltip>
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: "text.disabled",
              mt: 0.5,
              display: 'block'
            }}>
            Der Kommentar wird direkt auf GitHub veröffentlicht.
          </Typography>
        </CardContent>
      </Card>
      <ResolveDialog open={resolveOpen} onClose={() => setResolveOpen(false)} onConfirm={handleResolve} />
      <Snackbar open={snack.open} autoHideDuration={5000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default GithubIssueDetailPage;
