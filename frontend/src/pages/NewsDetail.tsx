import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Container,
  Chip,
  Stack,
  Divider,
  IconButton,
  Avatar,
  alpha,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PublicIcon from '@mui/icons-material/Public';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';
import { apiJson } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import NewsEditModal from '../modals/NewsEditModal';
import { DynamicConfirmationModal } from '../modals/DynamicConfirmationModal';
import RichTextContent from '../components/RichTextContent';

interface NewsItem {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  createdByUserName: string;
  createdByUserId: number;
  visibility: string;
  club?: number;
  team?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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

const NewsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchNewsDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson(`/news/${id}`);
      if (data && typeof data === 'object' && 'error' in data) {
        setError(data.error as string);
        setNews(null);
      } else {
        setNews(data as NewsItem);
      }
    } catch (e: any) {
      setError(e.message || 'Fehler beim Laden der Neuigkeit');
      setNews(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNewsDetail(); }, [id]);

  const confirmDelete = async () => {
    if (!news) return;
    setDeleteLoading(true);
    try {
      await apiJson(`/news/${news.id}/delete`, { method: 'POST' });
      navigate('/news');
    } catch {
      setDeleteLoading(false);
    }
  };

  const canEditOrDelete = user && news && (
    user.id === news.createdByUserId ||
    user?.roles?.['ROLE_ADMIN'] !== undefined ||
    user?.roles?.['ROLE_SUPERADMIN'] !== undefined
  );

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error || !news) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Card sx={{ borderTop: `4px solid ${theme.palette.error.main}` }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" color="error" gutterBottom sx={{ fontWeight: 500 }}>
              Nachricht nicht verfügbar
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {error || 'Die gewünschte Nachricht wurde nicht gefunden oder ist nicht mehr verfügbar.'}
            </Typography>
            <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/news')}>
              Zurück zur Übersicht
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const vis = VISIBILITY_CONFIG[news.visibility] ?? VISIBILITY_CONFIG.platform;

  // ── Detail View ─────────────────────────────────────────────────────────────
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* Back button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/news')}
        sx={{ mb: 2.5, color: 'text.secondary' }}
      >
        Alle Neuigkeiten
      </Button>

      <Card elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {/* ── Hero Header ─────────────────────────────────────────────────── */}
        <Box
          sx={{
            background: vis.gradient,
            px: { xs: 2.5, sm: 4 },
            py: { xs: 3, sm: 4 },
            position: 'relative',
            color: 'white',
          }}
        >
          {/* Edit/Delete Controls */}
          {canEditOrDelete && (
            <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 12, right: 12 }}>
              <IconButton
                size="small"
                onClick={() => setEditModalOpen(true)}
                sx={{ color: 'white', bgcolor: alpha('#fff', 0.15), '&:hover': { bgcolor: alpha('#fff', 0.3) } }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setDeleteDialogOpen(true)}
                sx={{ color: 'white', bgcolor: alpha('#fff', 0.15), '&:hover': { bgcolor: alpha('#f44336', 0.6) } }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}

          {/* Visibility Badge */}
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

          {/* Title */}
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.25,
              mb: 3,
              pr: canEditOrDelete ? 8 : 0,
              textShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          >
            {news.title}
          </Typography>

          {/* Author Row */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: alpha('#fff', 0.25),
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
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
        </Box>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <CardContent sx={{ px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 4 } }}>
          <RichTextContent html={news.content} />
        </CardContent>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
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
      </Card>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {news && (
        <>
          <NewsEditModal
            open={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSuccess={() => { setEditModalOpen(false); fetchNewsDetail(); }}
            news={news}
          />
          <DynamicConfirmationModal
            open={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
            onConfirm={confirmDelete}
            title="Neuigkeit löschen"
            message={`Möchtest du die Neuigkeit "${news.title}" wirklich löschen?`}
            confirmText="Löschen"
            confirmColor="error"
            loading={deleteLoading}
          />
        </>
      )}
    </Container>
  );
};

export default NewsDetail;
