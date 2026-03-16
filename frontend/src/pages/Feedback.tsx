import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Avatar, Card, CardContent, CardActions,
  Grid, Divider, Tabs, Tab, Badge, Alert, Tooltip, TextField, InputAdornment,
  Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Stack,
} from '@mui/material';
import FeedbackIcon from '@mui/icons-material/Feedback';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import HelpIcon from '@mui/icons-material/Help';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import GitHubIcon from '@mui/icons-material/GitHub';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PublicIcon from '@mui/icons-material/Public';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';
import { alpha } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { BACKEND_URL } from '../../config';
import { apiJson } from '../utils/api';

/* ─── Types ──────────────────────────────────────────── */

interface FeedbackItem {
  id: number;
  source: 'feedback' | 'github';
  createdAt: string;
  userName?: string;
  userId?: number;
  type: string;
  title?: string | null;
  message: string;
  url?: string;
  userAgent?: string;
  isRead: boolean;
  isResolved: boolean;
  adminNote?: string;
  screenshotPath?: string;
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
  /** populated from comments array length if backend sends full comments */
  commentCount: number;
  hasUnreadUserReplies: boolean;
}

/* ─── Helpers ────────────────────────────────────────── */

const TYPE_META: Record<string, { label: string; icon: React.ReactElement; color: string; bgcolor: string }> = {
  bug:      { label: 'Bug',          icon: <BugReportIcon />,  color: '#c62828', bgcolor: '#ffebee' },
  feature:  { label: 'Verbesserung', icon: <LightbulbIcon />,  color: '#e65100', bgcolor: '#fff3e0' },
  question: { label: 'Frage',        icon: <HelpIcon />,       color: '#1565c0', bgcolor: '#e3f2fd' },
  other:    { label: 'Sonstiges',    icon: <MoreHorizIcon />,  color: '#4e342e', bgcolor: '#efebe9' },
  github:   { label: 'GitHub Issue', icon: <GitHubIcon />,     color: '#24292f', bgcolor: '#f6f8fa' },
};

const getTypeMeta = (type: string) =>
  TYPE_META[type] ?? { label: type, icon: <MoreHorizIcon />, color: '#757575', bgcolor: '#f5f5f5' };

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name[0].toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* ─── TypeChip ───────────────────────────────────────── */
function TypeChip({ type }: { type: string }) {
  const m = getTypeMeta(type);
  return (
    <Chip
      icon={React.cloneElement(m.icon as React.ReactElement<any>, { style: { color: m.color, fontSize: 16 } })}
      label={m.label}
      size="small"
      sx={{ bgcolor: m.bgcolor, color: m.color, fontWeight: 600, fontSize: '0.75rem', border: `1px solid ${m.color}30` }}
    />
  );
}

/* ─── StatusChip ─────────────────────────────────────── */
function StatusChip({ isResolved, isRead }: { isResolved: boolean; isRead: boolean }) {
  if (isResolved) return <Chip label="Erledigt"       size="small" icon={<CheckCircleIcon />} color="success" sx={{ fontWeight: 600 }} />;
  if (isRead)     return <Chip label="In Bearbeitung" size="small" color="warning" sx={{ fontWeight: 600 }} />;
  return               <Chip label="Neu"              size="small" color="error"   sx={{ fontWeight: 600 }} />;
}

/* ─── CommentPill ────────────────────────────────────── */
function CommentPill({ count, hasUnread }: { count: number; hasUnread: boolean }) {
  if (count === 0 && !hasUnread) return null;
  return (
    <Tooltip title={hasUnread ? 'Ungelesene Nutzer-Antwort(en)' : `${count} Kommentar(e)`}>
      <Chip
        icon={<ChatBubbleOutlineIcon sx={{ fontSize: '14px !important' }} />}
        label={count}
        size="small"
        color={hasUnread ? 'warning' : 'default'}
        variant={hasUnread ? 'filled' : 'outlined'}
        sx={{ fontWeight: 700, height: 22, fontSize: '0.72rem', cursor: 'default' }}
      />
    </Tooltip>
  );
}

/* ─── FeedbackCard ───────────────────────────────────── */
interface FeedbackCardProps {
  item: FeedbackItem;
  tabIndex: number; // 0=Neu, 1=InBearbeitung, 2=Erledigt
  onMarkRead: (item: FeedbackItem) => void;
  onResolve: (item: FeedbackItem) => void;
  onReopen: (item: FeedbackItem) => void;
  onCreateGithubIssue: (item: FeedbackItem) => void;
  onShowScreenshot: (path: string) => void;
}

function FeedbackCard({
  item, tabIndex, onMarkRead, onResolve, onReopen, onCreateGithubIssue, onShowScreenshot,
}: FeedbackCardProps) {
  const navigate = useNavigate();
  const isGitHub = item.source === 'github';
  const m        = getTypeMeta(item.type);
  const initials = getInitials(item.userName);

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: item.isResolved ? 'success.light' : item.isRead ? 'warning.light' : 'error.light',
        borderLeft: '4px solid',
        borderLeftColor: item.isResolved ? 'success.main' : item.isRead ? 'warning.main' : 'error.main',
        borderRadius: 2,
        transition: 'box-shadow .15s',
        '&:hover': { boxShadow: 2 },
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* GitHub source banner */}
        {isGitHub && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 1.5, py: 0.75,
            bgcolor: '#f6f8fa', borderRadius: 1, border: '1px solid #d0d7de',
          }}>
            <GitHubIcon sx={{ fontSize: 16, color: '#24292f' }} />
            <Typography variant="caption" sx={{ color: '#24292f', fontWeight: 600 }}>GitHub Issue</Typography>
            <Chip label={`#${item.githubIssueNumber}`} size="small" variant="outlined"
              sx={{ height: 18, fontSize: '0.7rem', fontWeight: 700 }} />
            <Typography variant="caption" component="a" href={item.githubIssueUrl ?? '#'} target="_blank"
              sx={{ ml: 'auto', color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              Auf GitHub <OpenInNewIcon sx={{ fontSize: 11, verticalAlign: 'middle' }} />
            </Typography>
          </Box>
        )}

        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Avatar sx={{
            width: 36, height: 36, mt: 0.25, flexShrink: 0,
            bgcolor: isGitHub ? '#24292f' : m.color, fontSize: '0.8rem', fontWeight: 700,
          }}>
            {isGitHub ? <GitHubIcon sx={{ fontSize: 20 }} /> : initials}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Meta row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <Typography variant="body2" fontWeight={600}>{item.userName}</Typography>
              <TypeChip type={item.type} />
              <StatusChip isResolved={item.isResolved} isRead={item.isRead} />
              {!isGitHub && item.githubIssueNumber && (
                <Tooltip title={`GitHub Issue #${item.githubIssueNumber}`}>
                  <Chip icon={<GitHubIcon />} label={`#${item.githubIssueNumber}`} size="small"
                    component="a" href={item.githubIssueUrl ?? '#'} target="_blank" clickable sx={{ fontWeight: 600 }} />
                </Tooltip>
              )}
              {/* Comment pill + date — always at the right */}
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CommentPill count={item.commentCount} hasUnread={item.hasUnreadUserReplies} />
                <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
                  {fmtDate(item.createdAt)}
                </Typography>
              </Box>
            </Box>

            {/* GitHub title */}
            {isGitHub && item.title && (
              <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5, wordBreak: 'break-word' }}>
                {item.title}
              </Typography>
            )}

            {/* Message preview (max 3 lines) */}
            {item.message && (
              <Typography variant="body2" color="text.secondary"
                sx={{
                  whiteSpace: 'pre-line', wordBreak: 'break-word',
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                }}>
                {item.message}
              </Typography>
            )}

            {/* URL hint */}
            {item.url && !isGitHub && (
              <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PublicIcon sx={{ fontSize: 12, color: 'text.disabled', flexShrink: 0 }} />
                <Typography variant="caption" color="text.disabled"
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
                  {item.url}
                </Typography>
              </Box>
            )}
          </Box>

          {item.screenshotPath && (
            <Tooltip title="Screenshot anzeigen">
              <IconButton size="small" onClick={() => onShowScreenshot(item.screenshotPath!)}>
                <AttachFileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 1.5, pt: 0, flexWrap: 'wrap', gap: 0.75 }}>
        {/* Tab 0 — Neu: only "In Bearbeitung" */}
        {tabIndex === 0 && (
          <Button size="small" variant="outlined" startIcon={<MarkEmailReadIcon />} onClick={() => onMarkRead(item)}>
            In Bearbeitung
          </Button>
        )}

        {/* Tab 1 — In Bearbeitung: Bearbeiten + Erledigen */}
        {tabIndex === 1 && (
          <Button size="small" variant="outlined" startIcon={<EditIcon />}
            onClick={() => isGitHub
              ? navigate(`/admin/github-issue/${item.githubIssueNumber}`, { state: { tab: tabIndex } })
              : navigate(`/admin/feedback/${item.id}`, { state: { tab: tabIndex } })
            }>
            Bearbeiten
          </Button>
        )}
        {tabIndex === 1 && (
          <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon />}
            onClick={() => onResolve(item)}>
            Erledigen
          </Button>
        )}

        {/* Tab 2 — Erledigt: Bearbeiten + Wieder öffnen */}
        {tabIndex === 2 && (
          <Button size="small" variant="outlined" startIcon={<EditIcon />}
            onClick={() => isGitHub
              ? navigate(`/admin/github-issue/${item.githubIssueNumber}`, { state: { tab: tabIndex } })
              : navigate(`/admin/feedback/${item.id}`, { state: { tab: tabIndex } })
            }>
            Bearbeiten
          </Button>
        )}
        {tabIndex === 2 && (
          <Button size="small" variant="outlined" startIcon={<ReplayIcon />} onClick={() => onReopen(item)}>
            Wieder öffnen
          </Button>
        )}

        {/* Create GitHub Issue — only for platform feedback not yet linked */}
        {!isGitHub && !item.githubIssueNumber && (
          <Button size="small" variant="outlined" startIcon={<GitHubIcon />}
            sx={{ ml: 'auto' }} onClick={() => onCreateGithubIssue(item)}>
            Als GitHub Issue
          </Button>
        )}
      </CardActions>
    </Card>
  );
}

/* ─── ResolveDialog ──────────────────────────────────── */
function ResolveDialog({ open, item, onClose, onConfirm }: {
  open: boolean; item: FeedbackItem | null;
  onClose: () => void; onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  const isGitHub = item?.source === 'github';
  useEffect(() => { if (open) setNote(item?.adminNote ?? ''); }, [open, item]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pr: 6 }}>
        Feedback erledigen
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 12 }} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {item && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TypeChip type={item.type} />
              {isGitHub && item.githubIssueNumber && (
                <Chip icon={<GitHubIcon />} label={`Issue #${item.githubIssueNumber}`} size="small" />
              )}
            </Box>
            {item.title && (
              <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5, wordBreak: 'break-word' }}>
                {item.title}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary"
              sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
              {item.message}
            </Typography>
          </Box>
        )}
        <TextField
          label="Abschluss-Notiz (optional)" multiline rows={3} fullWidth value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optionale interne Notiz. Für Nachrichten an den Nutzer → Bearbeiten-Seite nutzen."
        />
        {isGitHub && (
          <Alert severity="info" sx={{ mt: 1.5, borderRadius: 1.5 }}>
            Das GitHub Issue wird automatisch geschlossen und erhält einen Status-Kommentar.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Abbrechen</Button>
        <Button onClick={() => onConfirm(note)} variant="contained" color="success" startIcon={<CheckCircleIcon />}>
          Erledigen
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── GitHubIssueDialog ──────────────────────────────── */
function GitHubIssueDialog({ open, item, onClose, onConfirm }: {
  open: boolean; item: FeedbackItem | null;
  onClose: () => void; onConfirm: (title: string) => void;
}) {
  const [title, setTitle] = useState('');
  useEffect(() => {
    if (open && item) setTitle(`[Feedback] ${item.message.slice(0, 80)}`);
  }, [open, item]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pr: 6 }}>
        Als GitHub Issue anlegen
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 12 }} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <TextField label="Issue-Titel" fullWidth value={title} onChange={e => setTitle(e.target.value)} sx={{ mb: 2 }} />
        {item && (
          <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">Issue Body (automatisch generiert):</Typography>
            <Typography variant="body2" sx={{
              mt: 0.5, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-word',
            }}>
              {`**Feedback von:** ${item.userName}\n**Typ:** ${item.type}\n**URL:** ${item.url ?? '—'}\n\n---\n\n${item.message}`}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Abbrechen</Button>
        <Button onClick={() => onConfirm(title)} variant="contained" startIcon={<GitHubIcon />}
          disabled={!title.trim()}>
          Issue erstellen
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Main Component ─────────────────────────────────── */

const FeedbackPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab]                 = useState<number>((location.state as any)?.tab ?? 0);
  const [unresolved, setUnresolved]   = useState<FeedbackItem[]>([]);
  const [inProgress, setInProgress]   = useState<FeedbackItem[]>([]);
  const [resolved, setResolved]       = useState<FeedbackItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [resolveItem, setResolveItem] = useState<FeedbackItem | null>(null);
  const [ghItem, setGhItem]           = useState<FeedbackItem | null>(null);
  const [screenshot, setScreenshot]   = useState<string | null>(null);
  const [snack, setSnack]             = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success',
  });

  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  const toItem = (i: any): FeedbackItem => ({
    ...i,
    commentCount: i.commentCount ?? (Array.isArray(i.comments) ? i.comments.length : 0),
  });

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson('/admin/feedback', { method: 'GET' });
      setUnresolved((data.unresolved || []).map(toItem));
      setInProgress((data.read       || []).map(toItem));
      setResolved(  (data.resolved   || []).map(toItem));
    } catch {
      showSnack('Fehler beim Laden der Daten.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdmin(); }, [loadAdmin]);

  const handleMarkRead = useCallback(async (item: FeedbackItem) => {
    if (item.source === 'github' && item.githubIssueNumber) {
      await apiJson(`/admin/feedback/github-issue/${item.githubIssueNumber}/mark-read`, { method: 'POST' });
    } else {
      await apiJson(`/admin/feedback/${item.id}/mark-read`, { method: 'POST' });
    }
    loadAdmin();
  }, [loadAdmin]);

  const handleResolve = useCallback(async (note: string) => {
    if (!resolveItem) return;
    if (resolveItem.source === 'github' && resolveItem.githubIssueNumber) {
      await apiJson(`/admin/feedback/github-issue/${resolveItem.githubIssueNumber}/resolve`, {
        method: 'POST', body: { adminNote: note },
      });
      showSnack(`GitHub Issue #${resolveItem.githubIssueNumber} erledigt und auf GitHub geschlossen.`);
    } else {
      await apiJson(`/admin/feedback/${resolveItem.id}/resolve`, {
        method: 'POST', body: { adminNote: note },
      });
      showSnack('Feedback als erledigt markiert.');
    }
    setResolveItem(null);
    loadAdmin();
  }, [resolveItem, loadAdmin]);

  const handleReopen = useCallback(async (item: FeedbackItem) => {
    if (item.source === 'github' && item.githubIssueNumber) {
      await apiJson(`/admin/feedback/github-issue/${item.githubIssueNumber}/reopen`, { method: 'POST' });
      showSnack(`GitHub Issue #${item.githubIssueNumber} wieder geöffnet.`);
    } else {
      await apiJson(`/admin/feedback/${item.id}/reopen`, { method: 'POST' });
      showSnack('Feedback wieder geöffnet.');
    }
    loadAdmin();
  }, [loadAdmin]);

  const handleCreateGithubIssue = useCallback(async (title: string) => {
    if (!ghItem) return;
    try {
      const data = await apiJson(`/admin/feedback/${ghItem.id}/create-github-issue`, {
        method: 'POST', body: { title },
      });
      setGhItem(null);
      showSnack(data.alreadyExisted ? 'Issue war bereits vorhanden.' : `GitHub Issue #${data.issueNumber} erstellt!`);
      loadAdmin();
    } catch {
      showSnack('GitHub Issue konnte nicht erstellt werden.', 'error');
    }
  }, [ghItem, loadAdmin]);

  const filter = (items: FeedbackItem[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.message.toLowerCase().includes(q) ||
      (i.title?.toLowerCase().includes(q)) ||
      (i.userName?.toLowerCase().includes(q)) ||
      i.type.toLowerCase().includes(q),
    );
  };

  const githubCount = [...unresolved, ...inProgress, ...resolved].filter(i => i.source === 'github').length;
  const unreadCount = [...unresolved, ...inProgress].filter(i => i.hasUnreadUserReplies).length;

  const ADMIN_TABS = [
    { label: 'Neu',            items: unresolved, badge: unresolved.length, color: 'error'   as const },
    { label: 'In Bearbeitung', items: inProgress, badge: inProgress.length, color: 'warning' as const },
    { label: 'Erledigt',       items: resolved,   badge: resolved.length,   color: 'success' as const },
  ];

  const currentTabItems = filter(ADMIN_TABS[tab]?.items ?? []);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.main', color: 'white', display: 'flex' }}>
          <FeedbackIcon sx={{ fontSize: 30 }} />
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={700}>Feedback-Verwaltung</Typography>
          <Typography variant="body2" color="text.secondary">
            Benutzer-Rückmeldungen und GitHub Issues im einheitlichen Workflow
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {githubCount > 0 && (
            <Chip icon={<GitHubIcon />}
              label={`${githubCount} GitHub Issue${githubCount > 1 ? 's' : ''}`}
              sx={{ fontWeight: 600 }} />
          )}
          {unreadCount > 0 && (
            <Chip icon={<ChatBubbleOutlineIcon />}
              label={`${unreadCount} neue Nutzer-Antwort${unreadCount > 1 ? 'en' : ''}`}
              color="warning" sx={{ fontWeight: 600 }} />
          )}
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: 'Neu',            value: unresolved.length,                                        color: '#c62828', bgcolor: '#ffebee' },
          { label: 'In Bearbeitung', value: inProgress.length,                                        color: '#e65100', bgcolor: '#fff3e0' },
          { label: 'Erledigt',       value: resolved.length,                                           color: '#2e7d32', bgcolor: '#e8f5e9' },
          { label: 'Gesamt',         value: unresolved.length + inProgress.length + resolved.length,   color: '#1565c0', bgcolor: '#e3f2fd' },
        ].map(s => (
          <Grid size={{ xs: 6, sm: 3 }} key={s.label}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: s.bgcolor, color: s.color, display: 'flex' }}>
                  <FeedbackIcon />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700} lineHeight={1}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* System-Alerts cross-link */}
      <Box
        component="button"
        onClick={() => navigate('/admin/system-alerts')}
        sx={(theme) => ({
          display: 'flex', alignItems: 'center', gap: 1.5, mb: 3,
          p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'error.light',
          bgcolor: alpha(theme.palette.error.main, 0.05),
          cursor: 'pointer', width: '100%', textAlign: 'left',
          '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.10) },
          transition: 'background 0.15s',
        })}
      >
        <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: 'error.main', color: 'white', display: 'flex' }}>
          <SecurityIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight={700} color="error.main">System-Alerts & Gesundheitsmonitoring</Typography>
          <Typography variant="caption" color="text.secondary">Server-Fehler, Login-Anomalien und Brute-Force-Angriffe mit Trend-Analyse</Typography>
        </Box>
        <Typography variant="caption" color="error.main" sx={{ flexShrink: 0 }}>→ Öffnen</Typography>
      </Box>

      {/* Search + Tabs */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Suchen …" value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment> }}
          sx={{ minWidth: 240 }}
        />
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ ml: 'auto', '& .MuiTab-root': { minHeight: 42 } }}>
          {ADMIN_TABS.map((t, i) => (
            <Tab
              key={i}
              label={
                t.badge > 0
                  ? <Badge badgeContent={t.badge} color={t.color}
                      sx={{ '& .MuiBadge-badge': { position: 'relative', top: -1, ml: 0.5, transform: 'none', transformOrigin: 'unset' } }}>
                      {t.label}
                    </Badge>
                  : t.label
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* Contextual hint */}
      {tab === 0 && unresolved.length > 0 && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
          Neues Feedback mit <strong>„In Bearbeitung"</strong> übernehmen — dann erscheint der <strong>Bearbeiten</strong>-Button mit vollem Kommentar-Thread.
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 6 }}><CircularProgress /></Box>
      ) : currentTabItems.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <FeedbackIcon sx={{ fontSize: 56, opacity: 0.2, mb: 1 }} />
          <Typography>{search ? 'Keine Treffer.' : 'Keine Einträge in diesem Tab.'}</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {currentTabItems.map(item => (
            <FeedbackCard
              key={`${item.source}-${item.id}`}
              item={item}
              tabIndex={tab}
              onMarkRead={handleMarkRead}
              onResolve={i => setResolveItem(i)}
              onReopen={handleReopen}
              onCreateGithubIssue={i => setGhItem(i)}
              onShowScreenshot={p => setScreenshot(p)}
            />
          ))}
        </Stack>
      )}

      {/* Dialogs */}
      <ResolveDialog
        open={!!resolveItem} item={resolveItem}
        onClose={() => setResolveItem(null)} onConfirm={handleResolve}
      />
      <GitHubIssueDialog
        open={!!ghItem} item={ghItem}
        onClose={() => setGhItem(null)} onConfirm={handleCreateGithubIssue}
      />
      <Dialog open={!!screenshot} onClose={() => setScreenshot(null)} maxWidth="md">
        <DialogTitle>
          Screenshot
          <IconButton onClick={() => setScreenshot(null)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {screenshot && <img src={`${BACKEND_URL}${screenshot}`} alt="Screenshot" style={{ maxWidth: '100%', borderRadius: 8 }} />}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snack.open} autoHideDuration={5000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default FeedbackPage;
