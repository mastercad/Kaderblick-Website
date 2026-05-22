import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Card, CardContent,
  Divider, Tooltip, TextField, Button, IconButton,
  Dialog, DialogTitle, DialogContent, Snackbar, Alert, Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FeedbackIcon from '@mui/icons-material/Feedback';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import HelpIcon from '@mui/icons-material/Help';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GitHubIcon from '@mui/icons-material/GitHub';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import PublicIcon from '@mui/icons-material/Public';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate, useParams } from 'react-router-dom';
import { BACKEND_URL } from '../../config';
import { apiJson } from '../utils/api';

/* ─── Types ──────────────────────────────────────────── */

interface FeedbackComment {
  id: number;
  content: string;
  isAdminMessage: boolean;
  authorName: string | null;
  createdAt: string;
}

interface FeedbackDetail {
  id: number;
  createdAt: string;
  type: string;
  message: string;
  url?: string;
  isRead: boolean;
  isResolved: boolean;
  adminNote?: string;
  screenshotPath?: string;
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
  comments: FeedbackComment[];
  hasUnreadAdminReply: boolean;
}

/* ─── Helpers ────────────────────────────────────────── */

const TYPE_META: Record<string, { label: string; icon: React.ReactElement; color: string; bgcolor: string }> = {
  bug:      { label: 'Bug',          icon: <BugReportIcon />,  color: '#c62828', bgcolor: '#ffebee' },
  feature:  { label: 'Verbesserung', icon: <LightbulbIcon />,  color: '#e65100', bgcolor: '#fff3e0' },
  question: { label: 'Frage',        icon: <HelpIcon />,       color: '#1565c0', bgcolor: '#e3f2fd' },
  other:    { label: 'Sonstiges',    icon: <MoreHorizIcon />,  color: '#4e342e', bgcolor: '#efebe9' },
};

const getTypeMeta = (type: string) =>
  TYPE_META[type] ?? { label: type, icon: <MoreHorizIcon />, color: '#757575', bgcolor: '#f5f5f5' };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* ─── CommentBubble (user view) ──────────────────────── */
function CommentBubble({ c }: { c: FeedbackComment }) {
  const isMine = !c.isAdminMessage; // user's own messages on the right
  return (
    <Box sx={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', gap: 1, alignItems: 'flex-end' }}>
      <Box sx={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0, mb: '2px',
        bgcolor: c.isAdminMessage ? 'primary.main' : 'grey.300',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.72rem', fontWeight: 700, color: c.isAdminMessage ? 'white' : 'text.primary',
      }}>
        {c.isAdminMessage ? 'A' : 'Ich'}
      </Box>
      <Box sx={{ maxWidth: '72%' }}>
        {!isMine && (
          <Typography
            variant="caption"
            sx={{
              color: "text.disabled",
              ml: 0.5,
              display: 'block',
              mb: 0.25
            }}>
            Admin
          </Typography>
        )}
        <Box sx={{
          p: 1.25, px: 1.75,
          borderRadius: isMine ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          bgcolor: isMine ? '#e3f2fd' : 'primary.main',
          color: isMine ? 'text.primary' : 'white',
          wordBreak: 'break-word',
          boxShadow: '0 1px 2px rgba(0,0,0,.08)',
        }}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.55 }}>{c.content}</Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: "text.disabled",
            mt: 0.3,
            display: 'block',
            textAlign: isMine ? 'right' : 'left',
            mr: isMine ? 0.5 : 0,
            ml: isMine ? 0 : 0.5
          }}>
          {fmtDate(c.createdAt)}
        </Typography>
      </Box>
    </Box>
  );
}

/* ─── Main Page ──────────────────────────────────────── */

const MyFeedbackDetailPage: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem]       = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText]       = useState('');
  const [sending, setSending] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [snack, setSnack]     = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const load = useCallback(async () => {
    try {
      // GET /{id} auto-marks admin comments as read
      const data = await apiJson(`/api/feedback/${id}`, { method: 'GET' });
      setItem(data);
    } catch {
      showSnack('Feedback konnte nicht geladen werden.', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Scroll to bottom when comments change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [item?.comments?.length]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !item) return;
    setSending(true);
    try {
      await apiJson(`/api/feedback/${item.id}/comment`, { method: 'POST', body: { content } });
      setText('');
      load(); // reload to get updated comment list
    } catch {
      showSnack('Nachricht konnte nicht gesendet werden.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }

  if (!item) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">Feedback nicht gefunden.</Typography>
        <Button onClick={() => navigate('/mein-feedback')} sx={{ mt: 2 }} startIcon={<ArrowBackIcon />}>
          Zurück zur Übersicht
        </Button>
      </Box>
    );
  }

  const m = getTypeMeta(item.type);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 760, mx: 'auto' }}>
      {/* Back + header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton onClick={() => navigate('/mein-feedback')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'primary.main', color: 'white', display: 'flex' }}>
          <FeedbackIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{
            fontWeight: 700
          }}>Feedback-Details</Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>{fmtDate(item.createdAt)}</Typography>
        </Box>
      </Box>
      {/* Metadata card */}
      <Card elevation={0} sx={{
        border: '1px solid', borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: item.isResolved ? 'success.main' : item.isRead ? 'warning.main' : 'error.main',
        borderRadius: 2, mb: 3,
      }}>
        <CardContent>
          {/* Type + status row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
            <Chip
              icon={React.cloneElement(m.icon as React.ReactElement<any>, { style: { color: m.color, fontSize: 16 } })}
              label={m.label} size="small"
              sx={{ bgcolor: m.bgcolor, color: m.color, fontWeight: 600, fontSize: '0.75rem', border: `1px solid ${m.color}30` }}
            />
            {item.isResolved
              ? <Chip label="Erledigt"       size="small" icon={<CheckCircleIcon />} color="success" sx={{ fontWeight: 600 }} />
              : item.isRead
                ? <Chip label="In Bearbeitung" size="small" color="warning" sx={{ fontWeight: 600 }} />
                : <Chip label="Ausstehend"     size="small" color="error"   sx={{ fontWeight: 600 }} />}
            {item.githubIssueNumber && (
              <Chip icon={<GitHubIcon />} label={`Issue #${item.githubIssueNumber}`} size="small"
                component="a" href={item.githubIssueUrl ?? '#'} target="_blank" clickable sx={{ fontWeight: 600 }} />
            )}
          </Box>

          {/* Message */}
          <Typography variant="body1" sx={{ mb: 1.5, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
            {item.message}
          </Typography>

          {item.url && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <PublicIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
              <Typography
                variant="caption"
                component="a"
                href={item.url}
                target="_blank"
                sx={{
                  color: 'inherit',
                  textDecoration: 'none',
                  wordBreak: 'break-all',
                  '&:hover': { textDecoration: 'underline' }
                }}>
                {item.url} <OpenInNewIcon sx={{ fontSize: 11, verticalAlign: 'middle' }} />
              </Typography>
            </Box>
          )}

          {item.screenshotPath && (
            <Button size="small" variant="outlined" startIcon={<AttachFileIcon />}
              sx={{ mt: 1 }} onClick={() => setScreenshot(item.screenshotPath!)}>
              Screenshot anzeigen
            </Button>
          )}

          {/* Legacy admin note */}
          {item.adminNote && item.comments.length === 0 && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1.5, borderLeft: '3px solid', borderLeftColor: 'primary.main' }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: "primary.dark"
                }}>Antwort des Admins:</Typography>
              <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                {item.adminNote}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
      {/* Comment thread */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <CardContent>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              mb: 2
            }}>
            Verlauf
            {item.comments.length > 0 && (
              <Typography
                component="span"
                variant="body2"
                sx={{
                  color: "text.secondary",
                  ml: 1
                }}>
                ({item.comments.length} Nachricht{item.comments.length !== 1 ? 'en' : ''})
              </Typography>
            )}
          </Typography>

          {item.comments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
              <Typography variant="body2">Noch keine Nachrichten. Stelle gerne eine Rückfrage!</Typography>
            </Box>
          ) : (
            <Stack spacing={1.5} sx={{ mb: 2.5 }}>
              {item.comments.map(c => <CommentBubble key={c.id} c={c} />)}
              <div ref={bottomRef} />
            </Stack>
          )}

          <Divider sx={{ mb: 2 }} />

          {/* Reply input */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              multiline maxRows={6} size="small" fullWidth
              placeholder="Nachricht an Admin… (Strg+Enter senden)"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSend(); } }}
              disabled={sending}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Tooltip title="Senden (Strg+Enter)">
              <span>
                <Button
                  variant="contained" onClick={handleSend}
                  disabled={!text.trim() || sending}
                  endIcon={<SendIcon />}
                  sx={{ flexShrink: 0, minWidth: 100 }}
                >
                  Senden
                </Button>
              </span>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>
      {/* Screenshot dialog */}
      <Dialog open={!!screenshot} onClose={() => setScreenshot(null)} maxWidth="md">
        <DialogTitle>
          Screenshot
          <IconButton onClick={() => setScreenshot(null)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {screenshot && <img src={`${BACKEND_URL}${screenshot}`} alt="Screenshot" style={{ maxWidth: '100%', borderRadius: 8 }} />}
        </DialogContent>
      </Dialog>
      <Snackbar open={snack.open} autoHideDuration={5000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default MyFeedbackDetailPage;
