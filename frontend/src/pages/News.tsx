import React, { useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, Typography, Stack, IconButton,
  Chip, Avatar, Skeleton, Tooltip, Divider, Paper, Snackbar, Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PublicIcon from '@mui/icons-material/Public';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import ArticleIcon from '@mui/icons-material/Article';
import NewsCreateModal from '../modals/NewsCreateModal';
import NewsEditModal from '../modals/NewsEditModal';
import { DynamicConfirmationModal } from '../modals/DynamicConfirmationModal';
import { apiJson } from '../utils/api';
import { useAuth } from '../context/AuthContext';

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

interface Club { id: number; name: string; }
interface Team { id: number; name: string; }
interface VisibilityOption { label: string; value: string; }

interface NewsApiResponse {
  clubs: Club[];
  news: NewsItem[];
  teams: Team[];
  visibilityOptions: VisibilityOption[];
  canCreate?: boolean;
}

// --- Helpers ---
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
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

const VISIBILITY_CONFIG: Record<string, { label: string; color: 'info' | 'success' | 'secondary'; icon: React.ReactElement }> = {
  platform: { label: 'Plattform', color: 'info', icon: <PublicIcon fontSize="small" /> },
  club: { label: 'Verein', color: 'success', icon: <BusinessIcon fontSize="small" /> },
  team: { label: 'Team', color: 'secondary', icon: <GroupsIcon fontSize="small" /> },
};

// --- NewsCard ---
const NewsCard: React.FC<{
  item: NewsItem;
  clubs: Club[];
  teams: Team[];
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
}> = ({ item, clubs, teams, onNavigate, onEdit, onDelete, canManage }) => {
  const vis = VISIBILITY_CONFIG[item.visibility] ?? { label: item.visibility, color: 'info' as const, icon: <PublicIcon fontSize="small" /> };
  const clubName = item.club ? clubs.find(c => c.id === item.club)?.name : null;
  const teamName = item.team ? teams.find(t => t.id === item.team)?.name : null;
  const scopeName = clubName || teamName;

  // Ersten Textabsatz extrahieren (HTML-Tags strippen)
  const plainContent = item.content.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();

  return (
    <Card
      elevation={1}
      sx={{
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.15s',
        '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
        borderLeft: 4,
        borderColor: vis.color === 'info' ? 'info.main' : vis.color === 'success' ? 'success.main' : 'secondary.main',
      }}
      onClick={onNavigate}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Avatar */}
          <Avatar sx={{ bgcolor: vis.color === 'info' ? 'info.light' : vis.color === 'success' ? 'success.light' : 'secondary.light', color: 'white', width: 44, height: 44, fontSize: 16, mt: 0.5, flexShrink: 0 }}>
            {initials(item.createdByUserName)}
          </Avatar>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Title row */}
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3, mb: 0.3 }} noWrap>
                {item.title}
              </Typography>
              {canManage && (
                <Stack direction="row" spacing={0} sx={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <Tooltip title="Bearbeiten">
                    <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Löschen">
                    <IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </Stack>
              )}
            </Stack>

            {/* Excerpt */}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                mb: 1,
              }}
            >
              {plainContent}
            </Typography>

            {/* Meta row */}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 0.5 }}>
              <Chip size="small" icon={vis.icon} label={scopeName ? `${vis.label}: ${scopeName}` : vis.label} color={vis.color} variant="outlined" />
              <Chip size="small" icon={<PersonIcon fontSize="small" />} label={item.createdByUserName} variant="outlined" sx={{ maxWidth: 160 }} />
              <Tooltip title={new Date(item.createdAt).toLocaleString('de-DE')}>
                <Chip size="small" icon={<CalendarTodayIcon fontSize="small" />} label={timeAgo(item.createdAt)} variant="outlined" />
              </Tooltip>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

// --- Main ---
const News: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [visibilityOptions, setVisibilityOptions] = useState<VisibilityOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNews, setEditNews] = useState<NewsItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteNews, setDeleteNews] = useState<NewsItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const handleEdit = (item: NewsItem) => { setEditNews(item); setEditModalOpen(true); };
  const handleDelete = (item: NewsItem) => { setDeleteNews(item); setDeleteDialogOpen(true); };

  const confirmDelete = async () => {
    if (!deleteNews) return;
    setDeleteLoading(true);
    try {
      await apiJson(`/news/${deleteNews.id}/delete`, { method: 'POST' });
      setDeleteDialogOpen(false);
      setDeleteNews(null);
      setSnackbar({ open: true, message: 'News gelöscht', severity: 'success' });
      fetchNews();
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Löschen', severity: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await apiJson('/news');
      const data = res as NewsApiResponse;
      setNews(data.news || []);
      setClubs(data.clubs || []);
      setTeams(data.teams || []);
      setVisibilityOptions(data.visibilityOptions || []);
      setCanCreate(data.canCreate ?? false);
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Laden der News', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNews(); }, []);

  return (
    <Box maxWidth={900} mx="auto">
      {/* Sticky Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 'var(--app-header-height)',
          zIndex: 10,
          bgcolor: 'background.default',
          pt: { xs: 1, sm: 2, md: 3 },
          pb: 1,
          px: { xs: 1, sm: 2, md: 3 },
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ArticleIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Neuigkeiten</Typography>
          </Stack>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setModalOpen(true)} size="medium">
              Neue Neuigkeit
            </Button>
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {news.length} {news.length === 1 ? 'Neuigkeit' : 'Neuigkeiten'} verfügbar
        </Typography>
      </Box>

      <Box p={{ xs: 1, sm: 2, md: 3 }}>

      {/* Loading */}
      {loading && (
        <Stack spacing={2}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={100} />
          ))}
        </Stack>
      )}

      {/* Empty state */}
      {!loading && news.length === 0 && (
        <Paper sx={{ p: 5, textAlign: 'center' }} elevation={0}>
          <ArticleIcon sx={{ fontSize: 56, color: 'grey.400', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">Keine Neuigkeiten verfügbar</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            {canCreate ? 'Erstelle die erste Neuigkeit, um dein Team zu informieren.' : 'Es sind noch keine Neuigkeiten vorhanden.'}
          </Typography>
          {canCreate && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
              Erste Neuigkeit erstellen
            </Button>
          )}
        </Paper>
      )}

      {/* News list */}
      {!loading && news.length > 0 && (
        <Stack spacing={1.5}>
          {news.map(item => (
            <NewsCard
              key={item.id}
              item={item}
              clubs={clubs}
              teams={teams}
              onNavigate={() => navigate(`/news/${item.id}`)}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
              canManage={user?.id === item.createdByUserId || user?.roles?.['ROLE_ADMIN'] !== undefined || user?.roles?.['ROLE_SUPERADMIN'] !== undefined}
            />
          ))}
        </Stack>
      )}

      {/* Modals */}
      <NewsEditModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditNews(null); }}
        onSuccess={() => { setEditModalOpen(false); setEditNews(null); fetchNews(); }}
        news={editNews || { id: 0, title: '', content: '' }}
      />
      <DynamicConfirmationModal
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="News löschen"
        message={deleteNews ? `Möchten Sie die News "${deleteNews.title}" wirklich löschen?` : ''}
        confirmText="Löschen"
        confirmColor="error"
        loading={deleteLoading}
      />
      <NewsCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchNews}
        clubs={clubs}
        teams={teams}
        visibilityOptions={visibilityOptions}
      />

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Box>
    </Box>
  );
};

export default News;
