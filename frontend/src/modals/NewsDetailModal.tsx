import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Stack,
  Avatar,
  Chip,
  Divider,
  IconButton,
  CircularProgress,
  alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PublicIcon from '@mui/icons-material/Public';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { apiJson } from '../utils/api';
import RichTextContent from '../components/RichTextContent';

interface NewsItem {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  createdByUserName: string;
  visibility: string;
}

const VISIBILITY_CONFIG: Record<string, {
  label: string;
  color: 'info' | 'success' | 'secondary';
  icon: React.ReactElement;
  gradient: string;
}> = {
  platform: {
    label: 'Plattform',
    color: 'info',
    icon: <PublicIcon fontSize="small" />,
    gradient: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
  },
  club: {
    label: 'Verein',
    color: 'success',
    icon: <BusinessIcon fontSize="small" />,
    gradient: 'linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%)',
  },
  team: {
    label: 'Team',
    color: 'secondary',
    icon: <GroupsIcon fontSize="small" />,
    gradient: 'linear-gradient(135deg, #7b1fa2 0%, #ce93d8 100%)',
  },
};

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Gerade eben';
  if (diffMin < 60) return `Vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Vor ${diffD} ${diffD === 1 ? 'Tag' : 'Tagen'}`;
  return `Vor ${Math.floor(diffD / 7)} ${Math.floor(diffD / 7) === 1 ? 'Woche' : 'Wochen'}`;
}

interface NewsDetailModalProps {
  newsId: number | null;
  open: boolean;
  onClose: () => void;
}

const NewsDetailModal: React.FC<NewsDetailModalProps> = ({ newsId, open, onClose }) => {
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || newsId === null) return;
    setLoading(true);
    setError(null);
    setNews(null);
    apiJson(`/news/${newsId}`)
      .then((data) => {
        if (data && typeof data === 'object' && 'error' in data) {
          setError(data.error as string);
        } else {
          setNews(data as NewsItem);
        }
      })
      .catch((e) => setError(e.message || 'Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, [open, newsId]);

  const vis = news
    ? (VISIBILITY_CONFIG[news.visibility] ?? VISIBILITY_CONFIG.platform)
    : VISIBILITY_CONFIG.platform;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          background: news ? vis.gradient : 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
          px: { xs: 2.5, sm: 4 },
          py: { xs: 3, sm: 4 },
          position: 'relative',
          color: 'white',
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 12, right: 12, color: 'white', bgcolor: alpha('#fff', 0.15), '&:hover': { bgcolor: alpha('#fff', 0.3) } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={28} sx={{ color: 'white' }} />
          </Box>
        )}

        {news && (
          <>
            <Chip
              size="small"
              icon={vis.icon}
              label={vis.label}
              sx={{
                mb: 2,
                bgcolor: alpha('#fff', 0.2),
                color: 'white',
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.35)',
                '& .MuiChip-icon': { color: 'white' },
              }}
            />
            <Typography
              variant="h5"
              component="h1"
              sx={{ fontWeight: 800, lineHeight: 1.25, mb: 3, pr: 4, textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
            >
              {news.title}
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ width: 36, height: 36, bgcolor: alpha('#fff', 0.25), color: 'white', fontSize: 13, fontWeight: 700 }}>
                {initials(news.createdByUserName)}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, opacity: 0.95 }}>
                  {news.createdByUserName}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {formatDate(news.createdAt)} · {timeAgo(news.createdAt)}
                </Typography>
              </Box>
            </Stack>
          </>
        )}

        {error && (
          <Typography sx={{ color: 'white', opacity: 0.9 }}>{error}</Typography>
        )}
      </Box>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {news && (
        <>
          <DialogContent sx={{ px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 4 } }}>
            <RichTextContent html={news.content} />
          </DialogContent>
          <Divider />
          <Box sx={{ px: { xs: 2.5, sm: 4 }, py: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.75 }}>
              <Chip size="small" icon={<PersonIcon fontSize="small" />} label={`Von ${news.createdByUserName}`} variant="outlined" />
              <Chip
                size="small"
                icon={<CalendarTodayIcon fontSize="small" />}
                label={new Date(news.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                variant="outlined"
              />
            </Stack>
          </Box>
        </>
      )}
    </Dialog>
  );
};

export default NewsDetailModal;
