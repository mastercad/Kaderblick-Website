import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Chip, CircularProgress, Card, CardContent,
  Tabs, Tab, TextField, InputAdornment, Stack, Dialog, DialogTitle,
  DialogContent, IconButton, Button, Tooltip,
} from '@mui/material';
import FeedbackIcon from '@mui/icons-material/Feedback';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import HelpIcon from '@mui/icons-material/Help';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GitHubIcon from '@mui/icons-material/GitHub';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../config';
import { apiJson } from '../utils/api';

/* ─── Types ──────────────────────────────────────────── */

interface FeedbackItem {
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
  /** comment count derived from comments array */
  commentCount: number;
  hasUnreadAdminReply: boolean;
}

/* ─── Helpers ────────────────────────────────────────── */

const TYPE_META: Record<string, { label: string; icon: React.ReactElement; color: string; bgcolor: string }> = {
  bug:      { label: 'Bug',          icon: <BugReportIcon />, color: '#c62828', bgcolor: '#ffebee' },
  feature:  { label: 'Verbesserung', icon: <LightbulbIcon />, color: '#e65100', bgcolor: '#fff3e0' },
  question: { label: 'Frage',        icon: <HelpIcon />,      color: '#1565c0', bgcolor: '#e3f2fd' },
  other:    { label: 'Sonstiges',    icon: <MoreHorizIcon />, color: '#4e342e', bgcolor: '#efebe9' },
};
const getTypeMeta = (type: string) =>
  TYPE_META[type] ?? { label: type, icon: <MoreHorizIcon />, color: '#757575', bgcolor: '#f5f5f5' };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* ─── CommentPill ────────────────────────────────────── */
function CommentPill({ count, hasUnread }: { count: number; hasUnread: boolean }) {
  if (count === 0 && !hasUnread) return null;
  return (
    <Tooltip title={hasUnread ? 'Admin hat geantwortet — ungelesen' : `${count} Nachricht(en)`}>
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

/* ─── StatsStrip ─────────────────────────────────────── */
function StatsStrip({ items }: { items: FeedbackItem[] }) {
  const total    = items.length;
  const resolved = items.filter(i => i.isResolved).length;
  const pending  = items.filter(i => !i.isResolved).length;
  const unread   = items.filter(i => i.hasUnreadAdminReply).length;

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
      {[
        { label: 'Eingereicht', value: total,    color: '#1565c0', bgcolor: '#e3f2fd' },
        { label: 'Ausstehend',  value: pending,  color: '#c62828', bgcolor: '#ffebee' },
        { label: 'Erledigt',    value: resolved, color: '#2e7d32', bgcolor: '#e8f5e9' },
        { label: 'Neue Antworten', value: unread, color: '#6a1b9a', bgcolor: '#f3e5f5' },
      ].map(s => (
        <Box key={s.label} sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
          borderRadius: 2, bgcolor: s.bgcolor, border: '1px solid', borderColor: `${s.color}30`,
        }}>
          <Typography variant="h6" fontWeight={700} color={s.color} lineHeight={1}>{s.value}</Typography>
          <Typography variant="caption" color="text.secondary">{s.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ─── FeedbackCard ───────────────────────────────────── */
function FeedbackCard({ item, onShowScreenshot }: {
  item: FeedbackItem;
  onShowScreenshot: (p: string) => void;
}) {
  const navigate = useNavigate();
  const m = getTypeMeta(item.type);
  const statusLabel = item.isResolved ? 'Erledigt' : item.isRead ? 'In Bearbeitung' : 'Ausstehend';
  const statusColor: 'success' | 'warning' | 'error' = item.isResolved ? 'success' : item.isRead ? 'warning' : 'error';

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: item.hasUnreadAdminReply ? 'warning.light' : item.isResolved ? 'success.light' : 'divider',
        borderLeft: '4px solid',
        borderLeftColor: item.hasUnreadAdminReply ? 'warning.main' : item.isResolved ? 'success.main' : item.isRead ? 'warning.main' : 'error.main',
        borderRadius: 2,
        transition: 'box-shadow .15s',
        '&:hover': { boxShadow: 2 },
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <Chip
            icon={React.cloneElement(m.icon as React.ReactElement<any>, { style: { color: m.color, fontSize: 15 } })}
            label={m.label} size="small"
            sx={{ bgcolor: m.bgcolor, color: m.color, fontWeight: 600, fontSize: '0.72rem', border: `1px solid ${m.color}30` }}
          />
          <Chip label={statusLabel} size="small" color={statusColor}
            icon={item.isResolved ? <CheckCircleIcon /> : undefined} sx={{ fontWeight: 600 }} />
          {item.githubIssueNumber && (
            <Chip icon={<GitHubIcon />} label={`#${item.githubIssueNumber}`} size="small" component="a"
              href={item.githubIssueUrl ?? '#'} target="_blank" clickable sx={{ fontWeight: 600 }} />
          )}

          {/* right side: pills + date + screenshot */}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CommentPill count={item.commentCount} hasUnread={item.hasUnreadAdminReply} />
            <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
              {fmtDate(item.createdAt)}
            </Typography>
            {item.screenshotPath && (
              <Tooltip title="Screenshot">
                <IconButton size="small" onClick={() => onShowScreenshot(item.screenshotPath!)}>
                  <AttachFileIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Message preview */}
        <Typography variant="body2" color="text.secondary" sx={{
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          whiteSpace: 'pre-line', wordBreak: 'break-word',
        }}>
          {item.message}
        </Typography>

        {/* Unread admin reply hint */}
        {item.hasUnreadAdminReply && (
          <Box sx={{
            mt: 1.25, px: 1.5, py: 0.75, borderRadius: 1.5,
            bgcolor: 'warning.light', display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <ChatBubbleOutlineIcon sx={{ fontSize: 16, color: 'warning.dark' }} />
            <Typography variant="caption" fontWeight={600} color="warning.dark">
              Admin hat geantwortet — tippe auf Details zum Lesen.
            </Typography>
          </Box>
        )}

        {/* Details button */}
        <Box sx={{ mt: 1.25, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant={item.hasUnreadAdminReply ? 'contained' : 'outlined'}
            color={item.hasUnreadAdminReply ? 'warning' : 'primary'}
            startIcon={<VisibilityIcon />}
            onClick={() => navigate(`/mein-feedback/${item.id}`)}
          >
            {item.hasUnreadAdminReply ? 'Neue Antwort lesen' : 'Details'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

/* ─── Main ───────────────────────────────────────────── */

const MyFeedback: React.FC = () => {
  const [items, setItems]     = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState(0);
  const [search, setSearch]   = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiJson('/api/feedback/my')
      .then((data: any[]) =>
        setItems(data.map(i => ({
          ...i,
          commentCount: i.commentCount ?? (Array.isArray(i.comments) ? i.comments.length : 0),
        })))
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const unreads = items.filter(i => i.hasUnreadAdminReply).length;

  const filtered = items
    .filter(i =>
      tab === 0 ? true
      : tab === 1 ? !i.isResolved
      : tab === 2 ? i.isResolved
      : i.hasUnreadAdminReply
    )
    .filter(i => {
      const q = search.trim().toLowerCase();
      return !q || i.message.toLowerCase().includes(q) || i.type.toLowerCase().includes(q);
    });

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 860, mx: 'auto' }}>
      {/* Sticky Header + Controls */}
      <Box
        sx={{
          position: 'sticky',
          top: { xs: 56, md: 64 },
          zIndex: 10,
          bgcolor: 'background.default',
          pt: 1.5,
          mx: { xs: -2, md: -4 },
          px: { xs: 2, md: 4 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          mb: 2,
        }}
      >
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1.5 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.main', color: 'white', display: 'flex' }}>
            <FeedbackIcon sx={{ fontSize: 30 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>Mein Feedback</Typography>
            <Typography variant="body2" color="text.secondary">
              Übersicht deiner Rückmeldungen und Admin-Antworten
            </Typography>
          </Box>
          {unreads > 0 && (
            <Chip icon={<ChatBubbleOutlineIcon />}
              label={`${unreads} neue Antwort${unreads > 1 ? 'en' : ''}`}
              color="warning" sx={{ ml: 'auto', fontWeight: 700 }} />
          )}
        </Box>

        {/* Controls row – only visible after load */}
        {!loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1, flexWrap: 'wrap' }}>
            <TextField
              size="small" placeholder="Suchen …" value={search}
              onChange={e => setSearch(e.target.value)} sx={{ minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment> }}
            />
            <Tabs value={tab} onChange={(_, v) => setTab(v)}
              sx={{ ml: 'auto', minHeight: 'auto', '& .MuiTab-root': { minHeight: 36, py: 0.75 } }}>
              <Tab label={`Alle (${items.length})`} />
              <Tab label={`Ausstehend (${items.filter(i => !i.isResolved).length})`} />
              <Tab label={`Erledigt (${items.filter(i => i.isResolved).length})`} />
              {unreads > 0 && <Tab label={`Neue Antworten (${unreads})`} value={3} />}
            </Tabs>
          </Box>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <StatsStrip items={items} />

          {filtered.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              <FeedbackIcon sx={{ fontSize: 56, opacity: 0.2, mb: 1 }} />
              <Typography>{search ? 'Keine Treffer.' : 'Noch kein Feedback eingereicht.'}</Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {filtered.map(item => (
                <FeedbackCard key={item.id} item={item} onShowScreenshot={p => setScreenshot(p)} />
              ))}
            </Stack>
          )}
        </>
      )}

      {/* Screenshot dialog */}
      <Dialog open={!!screenshot} onClose={() => setScreenshot(null)} maxWidth="md">
        <DialogTitle>
          Screenshot
          <IconButton onClick={() => setScreenshot(null)} sx={{ position: 'absolute', right: 8, top: 8 }} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {screenshot && (
            <img src={`${BACKEND_URL}${screenshot}`} alt="Screenshot" style={{ maxWidth: '100%', borderRadius: 8 }} />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default MyFeedback;
