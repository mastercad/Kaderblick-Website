import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Fab,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArticleIcon from '@mui/icons-material/Article';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import CommentIcon from '@mui/icons-material/Comment';
import PushPinIcon from '@mui/icons-material/PushPin';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import LinkIcon from '@mui/icons-material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { apiJson } from '../utils/api';
import RichTextEditor from '../components/RichTextEditor';
import RichTextContent from '../components/RichTextContent';
import type {
  KnowledgeBaseCategory,
  KnowledgeBaseComment,
  KnowledgeBaseMedia,
  KnowledgeBasePostCard,
  KnowledgeBasePostDetail,
  KnowledgeBaseTag,
} from '../types/knowledgeBase';
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  fetchCategories,
  fetchComments,
  fetchPost,
  fetchPosts,
  fetchTags,
  toggleLike,
  togglePin,
  updatePost,
} from '../services/knowledgeBase';
import { SupporterApplicationModal } from '../modals/SupporterApplicationModal';
import { useTeamList } from '../hooks/useTeamList';
import TeamSelect from '../components/TeamSelect';

// ─── Category color palette ──────────────────────────────────────────────────

const CATEGORY_PALETTES: Array<{ from: string; to: string }> = [
  { from: '#7E57C2', to: '#5C6BC0' }, // purple-indigo
  { from: '#26A69A', to: '#00897B' }, // teal
  { from: '#EF5350', to: '#C62828' }, // red
  { from: '#42A5F5', to: '#1565C0' }, // blue
  { from: '#66BB6A', to: '#2E7D32' }, // green
  { from: '#FF7043', to: '#BF360C' }, // deep-orange
  { from: '#AB47BC', to: '#6A1B9A' }, // purple
  { from: '#26C6DA', to: '#00838F' }, // cyan
  { from: '#FFA726', to: '#E65100' }, // amber-orange
  { from: '#5C8A3C', to: '#33691E' }, // olive
];

function categoryPalette(cat: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) & 0xffff;
  return CATEGORY_PALETTES[hash % CATEGORY_PALETTES.length];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

function MediaIcon({ mediaType }: { mediaType: string }) {
  if (mediaType === 'youtube' || mediaType === 'vimeo') {
    return <PlayCircleOutlineIcon fontSize="small" sx={{ color: 'error.main' }} />;
  }
  if (mediaType === 'spotify' || mediaType === 'soundcloud') {
    return <MusicNoteIcon fontSize="small" sx={{ color: 'success.main' }} />;
  }
  return <LinkIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
}

// ─── Media embed helpers ───────────────────────────────────────────────────────

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function spotifyEmbedUrl(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

function MediaEmbed({ media }: { media: KnowledgeBaseMedia }) {
  const ytId = media.mediaType === 'youtube'
    ? (media.externalId ?? youtubeId(media.url))
    : null;
  const vmId = media.mediaType === 'vimeo'
    ? (media.externalId ?? vimeoId(media.url))
    : null;
  const spUrl = media.mediaType === 'spotify' ? spotifyEmbedUrl(media.url) : null;

  if (ytId) {
    return (
      <Box sx={{ position: 'relative', pt: '56.25%', borderRadius: 2, overflow: 'hidden', bgcolor: 'black' }}>
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          title={media.label ?? 'YouTube Video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        />
      </Box>
    );
  }

  if (vmId) {
    return (
      <Box sx={{ position: 'relative', pt: '56.25%', borderRadius: 2, overflow: 'hidden', bgcolor: 'black' }}>
        <iframe
          src={`https://player.vimeo.com/video/${vmId}`}
          title={media.label ?? 'Vimeo Video'}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        />
      </Box>
    );
  }

  if (spUrl) {
    return (
      <iframe
        src={spUrl}
        title={media.label ?? 'Spotify'}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        style={{ width: '100%', height: 152, borderRadius: 8, border: 'none', display: 'block' }}
      />
    );
  }

  if (media.mediaType === 'image') {
    return (
      <Box
        component="a"
        href={media.url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: 'block', borderRadius: 2, overflow: 'hidden', lineHeight: 0 }}
      >
        <Box
          component="img"
          src={media.url}
          alt={media.label ?? ''}
          sx={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block', bgcolor: 'action.hover' }}
        />
      </Box>
    );
  }

  return (
    <Box
      component="a"
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        textDecoration: 'none',
        bgcolor: 'action.hover',
        '&:hover': { bgcolor: 'action.selected' },
        transition: 'background-color 0.15s',
      }}
    >
      <MediaIcon mediaType={media.mediaType} />
      <Box flex={1} minWidth={0}>
        {media.label && (
          <Typography variant="body2" fontWeight={500} color="text.primary" noWrap>
            {media.label}
          </Typography>
        )}
        <Typography variant="caption" color="primary.main" noWrap sx={{ display: 'block' }}>
          {media.url}
        </Typography>
      </Box>
      <OpenInNewIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
    </Box>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

const PostCard: React.FC<{
  post: KnowledgeBasePostCard;
  onOpen: () => void;
  onLike: () => void;
  onTagClick: (tag: string) => void;
  activeTag: string | null;
  liking?: boolean;
}> = ({ post, onOpen, onLike, onTagClick, activeTag, liking = false }) => {
  const thumbnailUrl = post.primaryMedia?.thumbnailUrl ?? null;
  const isEmbeddableVideo = post.primaryMedia?.mediaType === 'youtube' || post.primaryMedia?.mediaType === 'vimeo' || post.primaryMedia?.mediaType === 'video';
  const isAudio = post.primaryMedia?.mediaType === 'spotify' || post.primaryMedia?.mediaType === 'soundcloud';
  const hasVisualHeader = !!thumbnailUrl || post.primaryMedia?.mediaType === 'youtube' || isAudio;
  const palette = categoryPalette(post.category);

  return (
    <Card
      elevation={1}
      sx={{
        borderRadius: 2,
        transition: 'box-shadow 0.2s, transform 0.15s',
        '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {post.isPinned && (
        <Tooltip title="Angepinnt">
          <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'background.paper', borderRadius: '50%', p: 0.25, lineHeight: 0 }}>
            <PushPinIcon fontSize="small" sx={{ color: 'primary.main', display: 'block' }} />
          </Box>
        </Tooltip>
      )}

      <CardActionArea onClick={onOpen} sx={{ display: 'block' }}>
        {/* Thumbnail: use resolved thumbnailUrl if available, with play overlay for video types */}
        {thumbnailUrl && (
          <Box sx={{ position: 'relative', pt: '52.25%', bgcolor: '#111', overflow: 'hidden' }}>
            <Box
              component="img"
              src={thumbnailUrl}
              alt={post.title}
              sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {isEmbeddableVideo && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.18)' }}>
                <PlayCircleOutlineIcon sx={{ fontSize: 52, color: 'white', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }} />
              </Box>
            )}
          </Box>
        )}

        {/* YouTube thumbnail with play overlay */}
        {!thumbnailUrl && post.primaryMedia?.mediaType === 'youtube' && (
          <Box sx={{ position: 'relative', pt: '52.25%', bgcolor: '#111', overflow: 'hidden' }}>
            <Box
              component="img"
              src={`https://img.youtube.com/vi/${post.primaryMedia.externalId ?? youtubeId(post.primaryMedia.url)}/hqdefault.jpg`}
              alt={post.title}
              sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.18)' }}>
              <PlayCircleOutlineIcon sx={{ fontSize: 52, color: 'white', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }} />
            </Box>
          </Box>
        )}

        {/* Audio placeholder */}
        {isAudio && (
          <Box sx={{ height: 72, bgcolor: '#2E7D32', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            <MusicNoteIcon sx={{ fontSize: 28, color: 'white' }} />
            <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
              {post.primaryMedia!.mediaType === 'spotify' ? 'Spotify' : 'SoundCloud'}
            </Typography>
          </Box>
        )}

        {/* No-media decorative banner */}
        {!hasVisualHeader && (
          <Box
            sx={{
              height: 110,
              position: 'relative',
              overflow: 'hidden',
              background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
            }}
          >
            {/* Decorative bg circles */}
            <Box sx={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.07)', top: -40, right: -30 }} />
            <Box sx={{ position: 'absolute', width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.07)', bottom: -25, left: 10 }} />
            <Box sx={{ position: 'absolute', width: 50, height: 50, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)', top: 10, left: '40%' }} />
            {/* Content */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                px: 2,
              }}
            >
              <ArticleIcon sx={{ fontSize: 38, color: 'rgba(255,255,255,0.9)', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }} />
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255,255,255,0.82)',
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  fontSize: 10,
                  textAlign: 'center',
                  lineHeight: 1.3,
                  maxWidth: '90%',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {post.category}
              </Typography>
            </Box>
          </Box>
        )}

        <CardContent sx={{ pb: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" mb={0.75}>
            <Chip label={post.category} size="small" variant="outlined" />
          </Stack>

          <Typography variant="subtitle1" fontWeight={600} gutterBottom noWrap>
            {post.title}
          </Typography>

          {post.tags.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap mb={1}>
              {post.tags.slice(0, 3).map(tag => (
                <Chip
                  key={tag.id}
                  label={`#${tag.name}`}
                  size="small"
                  onClick={e => { e.stopPropagation(); onTagClick(tag.name); }}
                  sx={{
                    height: 18,
                    fontSize: 11,
                    cursor: 'pointer',
                    bgcolor: activeTag === tag.name ? 'primary.main' : undefined,
                    color: activeTag === tag.name ? 'primary.contrastText' : undefined,
                    '&:hover': { bgcolor: activeTag === tag.name ? 'primary.dark' : 'action.selected' },
                  }}
                />
              ))}
              {post.tags.length > 3 && (
                <Chip label={`+${post.tags.length - 3}`} size="small" sx={{ height: 18, fontSize: 11 }} />
              )}
            </Stack>
          )}

          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar sx={{ width: 22, height: 22, fontSize: 11 }}>{initials(post.createdBy.name)}</Avatar>
            <Typography variant="caption" color="text.secondary" noWrap flex={1}>
              {post.createdBy.name} · {timeAgo(post.createdAt)}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>

      <Divider />
      <Stack direction="row" spacing={1} px={2} py={1} alignItems="center">
        <IconButton size="small" disabled={liking} onClick={e => { e.stopPropagation(); onLike(); }}>
          {post.liked
            ? <FavoriteIcon fontSize="small" sx={{ color: 'error.main' }} />
            : <FavoriteBorderIcon fontSize="small" />}
        </IconButton>
        <Typography variant="caption" color="text.secondary">{post.likeCount}</Typography>
        <CommentIcon fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />
        <Typography variant="caption" color="text.secondary">{post.commentCount}</Typography>
      </Stack>
    </Card>
  );
};

// ─── PostDetailDrawer ─────────────────────────────────────────────────────────

const PostDetailDrawer: React.FC<{
  postId: number | null;
  open: boolean;
  onClose: () => void;
  onEdit: (post: KnowledgeBasePostDetail) => void;
  onDeleted: () => void;
  onLikeToggled: (postId: number, liked: boolean, likeCount: number) => void;
  onTagClick: (tag: string) => void;
  activeTag: string | null;
}> = ({ postId, open, onClose, onEdit, onDeleted, onLikeToggled, onTagClick, activeTag }) => {
  const [post, setPost] = useState<KnowledgeBasePostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<KnowledgeBaseComment[]>([]);
  const [canComment, setCanComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [liking, setLiking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !postId) return;
    setLoading(true);
    setError(null);
    setPost(null);
    setComments([]);
    Promise.all([fetchPost(postId), fetchComments(postId)])
      .then(([p, c]) => {
        setPost(p);
        setComments(c.comments);
        setCanComment(c.canCreate);
      })
      .catch(() => setError('Beitrag konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [open, postId]);

  const handleLike = async () => {
    if (!post || liking) return;
    setLiking(true);
    try {
      const res = await toggleLike(post.id);
      setPost(p => p ? { ...p, liked: res.liked, likeCount: res.likeCount } : p);
      onLikeToggled(post.id, res.liked, res.likeCount);
    } finally {
      setLiking(false);
    }
  };

  const handlePin = async () => {
    if (!post || pinning) return;
    setPinning(true);
    try {
      const res = await togglePin(post.id);
      setPost(p => p ? { ...p, isPinned: res.isPinned } : p);
    } finally {
      setPinning(false);
    }
  };

  const handleAddComment = async () => {
    if (!post || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const newComment = await addComment(post.id, commentText.trim());
      setComments(c => [...c, newComment]);
      setCommentText('');
      setPost(p => p ? { ...p, commentCount: p.commentCount + 1 } : p);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    await deleteComment(commentId);
    setComments(c => c.filter(x => x.id !== commentId));
    setPost(p => p ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p);
  };

  const handleDelete = async () => {
    if (!post) return;
    await deletePost(post.id);
    onDeleted();
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, maxWidth: '100vw', display: 'flex', flexDirection: 'column' } }}
    >
      <Stack direction="row" alignItems="center" px={2} py={1.5} borderBottom={1} borderColor="divider">
        <Typography variant="h6" flex={1} noWrap>
          {post?.title ?? 'Beitrag'}
        </Typography>
        {post?.canPin && (
          <Tooltip title={post.isPinned ? 'Anpinnen aufheben' : 'Anpinnen'}>
            <IconButton onClick={handlePin} disabled={pinning}>
              <PushPinIcon fontSize="small" color={post.isPinned ? 'primary' : 'disabled'} />
            </IconButton>
          </Tooltip>
        )}
        {post?.canEdit && (
          <Tooltip title="Bearbeiten">
            <IconButton onClick={() => post && onEdit(post)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {post?.canDelete && (
          <Tooltip title="Löschen">
            <IconButton onClick={handleDelete} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </Stack>

      <Box flex={1} overflow="auto" px={2} py={2}>
        {loading && (
          <Stack spacing={1}>
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
            <Skeleton width="60%" />
            <Skeleton width="40%" />
          </Stack>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {post && !loading && (
          <Stack spacing={2}>
            {/* Media embeds — hero at the top */}
            {post.mediaLinks.length > 0 && (
              <Stack spacing={1.5}>
                {post.mediaLinks.map(m => (
                  <MediaEmbed key={m.id} media={m} />
                ))}
              </Stack>
            )}

            {/* Meta */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Chip label={post.category} size="small" variant="outlined" />
              {post.isPinned && <Chip icon={<PushPinIcon fontSize="small" />} label="Angepinnt" size="small" color="primary" />}
              {post.tags.map(tag => (
                <Chip
                  key={tag.id}
                  label={`#${tag.name}`}
                  size="small"
                  onClick={() => { onTagClick(tag.name); onClose(); }}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: activeTag === tag.name ? 'primary.main' : undefined,
                    color: activeTag === tag.name ? 'primary.contrastText' : undefined,
                    '&:hover': { bgcolor: activeTag === tag.name ? 'primary.dark' : 'action.selected' },
                  }}
                />
              ))}
            </Stack>

            {/* Description */}
            {post.description && (
              <RichTextContent html={post.description} />
            )}

            {/* Author/date */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>{initials(post.createdBy.name)}</Avatar>
              <Box>
                <Typography variant="caption" display="block">{post.createdBy.name}</Typography>
                <Typography variant="caption" color="text.secondary">{timeAgo(post.createdAt)}</Typography>
              </Box>
            </Stack>

            {/* Like */}
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton size="small" onClick={handleLike} disabled={liking}>
                {post.liked
                  ? <FavoriteIcon fontSize="small" sx={{ color: 'error.main' }} />
                  : <FavoriteBorderIcon fontSize="small" />}
              </IconButton>
              <Typography variant="body2">{post.likeCount} {post.likeCount === 1 ? 'Like' : 'Likes'}</Typography>
            </Stack>

            <Divider />

            {/* Comments */}
            <Typography variant="subtitle2">Kommentare ({comments.length})</Typography>
            <Stack spacing={1.5}>
              {comments.map(c => (
                <Stack key={c.id} direction="row" spacing={1} alignItems="flex-start">
                  <Avatar sx={{ width: 28, height: 28, fontSize: 12, mt: 0.5 }}>{initials(c.user.name)}</Avatar>
                  <Box flex={1} bgcolor="action.hover" borderRadius={1} px={1.5} py={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" fontWeight={600}>{c.user.name}</Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="caption" color="text.secondary">{timeAgo(c.createdAt)}</Typography>
                        {c.canDelete && (
                          <IconButton size="small" onClick={() => handleDeleteComment(c.id)}>
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Stack>
                    </Stack>
                    <Typography variant="body2" whiteSpace="pre-line">{c.content}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            {canComment && (
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  maxRows={4}
                  placeholder="Kommentar schreiben…"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                />
                <IconButton
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || submitting}
                  color="primary"
                >
                  <SendIcon fontSize="small" />
                </IconButton>
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
};

// ─── PostFormDialog ───────────────────────────────────────────────────────────

interface TagOption {
  id: number | null;
  name: string;
}

interface MediaUrlEntry {
  url: string;
}

interface PostFormData {
  title: string;
  description: string;
  categoryId: number | '';
  tags: Array<TagOption | string>;
  mediaUrls: MediaUrlEntry[];
  sendNotification: boolean;
}

function detectMediaTypeForIcon(url: string): string {
  if (/youtu(be\.com|\.be)/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  if (/spotify\.com/i.test(url)) return 'spotify';
  if (/soundcloud\.com/i.test(url)) return 'soundcloud';
  return 'link';
}

const PostFormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  teamId: number;
  teams: Array<{ id: number; name: string; assigned?: boolean }>;
  categories: KnowledgeBaseCategory[];
  editPost?: KnowledgeBasePostDetail;
  defaultCategoryId?: number | null;
  isSuperAdmin?: boolean;
}> = ({ open, onClose, onSaved, teamId, teams, categories: categoriesFromParent, editPost, defaultCategoryId, isSuperAdmin }) => {
  const isEdit = !!editPost;
  const [selectedTeamId, setSelectedTeamId] = useState<number>(teamId);
  const [teamChangedByUser, setTeamChangedByUser] = useState(false);
  // true only when user switched teams AND a previously selected category couldn't be matched in the new team
  const [categoryLostOnTeamChange, setCategoryLostOnTeamChange] = useState(false);
  // categories for the currently selected team inside the dialog
  const [dialogCategories, setDialogCategories] = useState<KnowledgeBaseCategory[]>(categoriesFromParent);
  const [form, setForm] = useState<PostFormData>({
    title: '',
    description: '',
    categoryId: '',
    tags: [],
    mediaUrls: [],
    sendNotification: false,
  });
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset everything when dialog opens
  useEffect(() => {
    if (!open) return;
    setTeamChangedByUser(false);
    setCategoryLostOnTeamChange(false);
    // In create mode: SuperAdmins default to global (0); others default to first available team
    const effectiveTeamId = (!isEdit && !teamId)
      ? (isSuperAdmin ? 0 : (teams.length > 0 ? teams[0].id : 0))
      : teamId;
    setSelectedTeamId(effectiveTeamId);
    setDialogCategories(categoriesFromParent);
    fetchTags(effectiveTeamId)
      .then(res => setAvailableTags((res.tags ?? []).map((t: KnowledgeBaseTag) => ({ id: t.id, name: t.name }))))
      .catch(() => setAvailableTags([]));
    if (editPost) {
      setForm({
        title: editPost.title,
        description: editPost.description ?? '',
        categoryId: editPost.categoryId,
        tags: editPost.tags.map(t => ({ id: t.id, name: t.name })),
        mediaUrls: editPost.mediaLinks.map(m => ({ url: m.url })),
        sendNotification: false,
      });
    } else {
      setForm({ title: '', description: '', categoryId: defaultCategoryId ?? '', tags: [], mediaUrls: [], sendNotification: false });
    }
    setError(null);
    setMediaUrlInput('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When the team changes inside the dialog: reload categories + tags and re-match by name
  const handleTeamChange = (newTeamId: number) => {
    setTeamChangedByUser(true);
    setSelectedTeamId(newTeamId);
    // remember current names before reloading
    const currentCategoryName = dialogCategories.find(c => c.id === form.categoryId)?.name ?? null;
    const currentTagNames = form.tags.map(t => (typeof t === 'string' ? t.trim() : t.name.trim()));

    Promise.all([
      fetchCategories(newTeamId).catch(() => ({ categories: [] as KnowledgeBaseCategory[], canManageCategories: false })),
      fetchTags(newTeamId).catch(() => ({ tags: [] as KnowledgeBaseTag[] })),
    ]).then(([catRes, tagRes]) => {
      const newCats = catRes.categories ?? [];
      const newTags: TagOption[] = (tagRes.tags ?? []).map((t: KnowledgeBaseTag) => ({ id: t.id, name: t.name }));
      setDialogCategories(newCats);
      setAvailableTags(newTags);

      // Re-match category by name (case-insensitive)
      const matchedCat = currentCategoryName
        ? newCats.find(c => c.name.toLowerCase() === currentCategoryName.toLowerCase())
        : null;
      const newCategoryId = matchedCat ? matchedCat.id : '';

      // Only warn if there WAS a category selected before and it couldn't be matched
      setCategoryLostOnTeamChange(!!currentCategoryName && !matchedCat);

      // Re-match tags by name: use existing TagOption if found, keep as string (new) if not
      const newTagValues: Array<TagOption | string> = currentTagNames.map(name => {
        const found = newTags.find(t => t.name.toLowerCase() === name.toLowerCase());
        return found ?? name;
      });

      setForm(f => ({ ...f, categoryId: newCategoryId, tags: newTagValues }));
    });
  };

  const addMediaUrl = () => {
    const url = mediaUrlInput.trim();
    if (!url || form.mediaUrls.some(m => m.url === url)) return;
    setForm(f => ({ ...f, mediaUrls: [...f.mediaUrls, { url }] }));
    setMediaUrlInput('');
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Titel darf nicht leer sein.'); return; }
    if (!form.categoryId) { setError('Bitte eine Kategorie wählen.'); return; }
    setSaving(true);
    setError(null);
    const tags = form.tags
      .map(t => (typeof t === 'string' ? t.trim() : t.name.trim()))
      .filter(Boolean);
    try {
      if (isEdit && editPost) {
        await updatePost(editPost.id, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          categoryId: Number(form.categoryId),
          tags,
          mediaLinks: form.mediaUrls.map(m => ({ url: m.url })),
        });
      } else {
        await createPost({
          // selectedTeamId=0 means global (no team); omit teamId so backend treats it as global
          ...(selectedTeamId > 0 ? { teamId: selectedTeamId } : {}),
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          categoryId: Number(form.categoryId),
          tags,
          mediaLinks: form.mediaUrls.map(m => ({ url: m.url })),
          sendNotification: form.sendNotification,
        });
      }
      onSaved();
      onClose();
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #7E57C2 0%, #5C6BC0 100%)',
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isEdit
            ? <EditIcon sx={{ color: 'white' }} />
            : <AddIcon sx={{ color: 'white' }} />}
        </Box>
        <Box flex={1}>
          <Typography variant="h6" fontWeight={700} sx={{ color: 'white', lineHeight: 1.2 }}>
            {isEdit ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            {isEdit ? 'Änderungen am Wissenspool-Beitrag' : 'Wissen mit dem Team teilen'}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'white', opacity: 0.75, '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.15)' } }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* ── Content ── */}
      <DialogContent sx={{ px: 3, py: 3 }}>
        <Stack spacing={2.5}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
          )}

          {/* Team – nur beim Erstellen; Backend bestimmt welche Teams verfügbar sind */}
          {!isEdit && (
            <TeamSelect
              teams={teams}
              value={selectedTeamId === 0 ? '' : selectedTeamId}
              onChange={handleTeamChange}
              label="Team"
              size="small"
              fullWidth
              minWidth={0}
              allTeamsOption={isSuperAdmin ? { value: '', label: 'Global (kein Team)' } : undefined}
            />
          )}

          {/* Titel */}
          <TextField
            label="Titel *"
            fullWidth
            size="small"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Aussagekräftiger Titel…"
            autoFocus
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          {/* Kategorie */}
          <FormControl fullWidth size="small">
            <InputLabel>Kategorie *</InputLabel>
            <Select
              value={form.categoryId}
              label="Kategorie *"
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value as number }))}
              sx={{ borderRadius: 2 }}
            >
              {dialogCategories.map(c => (
                <MenuItem key={c.id} value={c.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {c.icon && <span>{c.icon}</span>}
                    <span>{c.name}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
            {!isEdit && categoryLostOnTeamChange && (
              <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
                Kategorie aus dem anderen Team nicht gefunden – bitte manuell auswählen.
              </Typography>
            )}
          </FormControl>

          {/* Beschreibung */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Inhalt
            </Typography>
            <RichTextEditor
              value={form.description}
              onChange={html => setForm(f => ({ ...f, description: html }))}
              placeholder="Worum geht es? Was soll das Team mitnehmen?"
              minHeight={220}
            />
          </Box>

          {/* Tags mit Autocomplete */}
          <Box>
            <Autocomplete<TagOption, true, false, true>
              multiple
              freeSolo
              options={availableTags}
              value={form.tags as Array<TagOption | string>}
              getOptionLabel={opt => (typeof opt === 'string' ? opt : opt.name)}
              isOptionEqualToValue={(opt, val) =>
                typeof opt !== 'string' && typeof val !== 'string'
                  ? opt.name.toLowerCase() === val.name.toLowerCase()
                  : false
              }
              onChange={(_, newVal) => {
                setForm(f => ({
                  ...f,
                  tags: newVal
                    .map(v => (typeof v === 'string' ? { id: null, name: v.trim() } : v))
                    .filter(t => t.name.trim() !== ''),
                }));
              }}
              filterOptions={(options, params) => {
                const input = params.inputValue.trim().toLowerCase();
                const filtered = options.filter(o => o.name.toLowerCase().includes(input));
                if (
                  input !== '' &&
                  !filtered.some(o => o.name.toLowerCase() === input) &&
                  !form.tags.some(t =>
                    (typeof t === 'string' ? t : t.name).toLowerCase() === input,
                  )
                ) {
                  filtered.push({ id: null, name: params.inputValue.trim() });
                }
                return filtered;
              }}
              renderOption={(props, option) => {
                const isNew = option.id === null;
                const { key, ...rest } = props as any;
                return (
                  <li key={key} {...rest}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={`#${option.name}`}
                        size="small"
                        color={isNew ? 'secondary' : 'default'}
                        sx={{ pointerEvents: 'none' }}
                      />
                      {isNew && (
                        <Typography variant="caption" color="text.secondary">
                          neu anlegen
                        </Typography>
                      )}
                    </Stack>
                  </li>
                );
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  const name = typeof option === 'string' ? option : option.name;
                  const isNew = typeof option !== 'string' && option.id === null;
                  return (
                    <Chip
                      key={key}
                      label={`#${name}`}
                      size="small"
                      color={isNew ? 'secondary' : 'default'}
                      {...tagProps}
                    />
                  );
                })
              }
              renderInput={params => (
                <TextField
                  {...params}
                  label="Tags"
                  size="small"
                  placeholder={form.tags.length === 0 ? 'Bestehende Tags wählen oder neu eingeben…' : ''}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              )}
            />
            {availableTags.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {availableTags.length} {availableTags.length === 1 ? 'Tag' : 'Tags'} vorhanden — bitte bevorzugt bestehende Tags verwenden
              </Typography>
            )}
          </Box>

          {/* Medien-Links */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              sx={{ display: 'block', mb: 1, letterSpacing: 0.5, textTransform: 'uppercase' }}
            >
              Medien-Links
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                fullWidth
                value={mediaUrlInput}
                onChange={e => setMediaUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMediaUrl(); } }}
                placeholder="YouTube, Vimeo, Spotify oder anderen Link…"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={addMediaUrl}
                disabled={!mediaUrlInput.trim()}
                sx={{ borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0, px: 2 }}
              >
                Hinzufügen
              </Button>
            </Stack>
            {form.mediaUrls.length > 0 && (
              <Stack spacing={0.75} mt={1}>
                {form.mediaUrls.map((m, i) => (
                  <Stack
                    key={i}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                      bgcolor: 'action.hover',
                      borderRadius: 2,
                      px: 1.5,
                      py: 0.75,
                    }}
                  >
                    <MediaIcon mediaType={detectMediaTypeForIcon(m.url)} />
                    <Typography variant="caption" noWrap flex={1} color="text.secondary" title={m.url}>
                      {m.url}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setForm(f => ({ ...f, mediaUrls: f.mediaUrls.filter((_, idx) => idx !== i) }))}
                      sx={{ flexShrink: 0 }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>

          {/* Benachrichtigung */}
          {!isEdit && (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                px: 2,
                py: 1.5,
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={500}>Team benachrichtigen</Typography>
                <Typography variant="caption" color="text.secondary">
                  Push-Benachrichtigung an alle Teammitglieder
                </Typography>
              </Box>
              <Switch
                checked={form.sendNotification}
                onChange={e => setForm(f => ({ ...f, sendNotification: e.target.checked }))}
              />
            </Stack>
          )}
        </Stack>
      </DialogContent>

      {/* ── Footer ── */}
      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1.5}
        sx={{
          px: 3,
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Button onClick={onClose} disabled={saving} sx={{ borderRadius: 2 }}>
          Abbrechen
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          sx={{
            borderRadius: 2,
            minWidth: 130,
            background: saving ? undefined : 'linear-gradient(135deg, #7E57C2 0%, #5C6BC0 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #6D45B0 0%, #4A59B0 100%)',
            },
            '&.Mui-disabled': { background: undefined },
          }}
        >
          {saving
            ? <CircularProgress size={18} color="inherit" />
            : isEdit ? 'Speichern' : 'Veröffentlichen'}
        </Button>
      </Stack>
    </Dialog>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  // Teams
  const { teams, loading: teamsLoading } = useTeamList();
  const [teamId, setTeamId] = useState<number | null>(null);

  // Categories
  const [categories, setCategories] = useState<KnowledgeBaseCategory[]>([]);
  const [canManageCategories, setCanManageCategories] = useState(false);
  const [activeCatId, setActiveCatId] = useState<number | null>(null); // null = "Alle"

  // Posts
  const [posts, setPosts] = useState<KnowledgeBasePostCard[]>([]);
  const [likingIds, setLikingIds] = useState<Set<number>>(new Set());
  const [canCreate, setCanCreate] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detail Drawer
  const [drawerPostId, setDrawerPostId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Create/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPost, setEditPost] = useState<KnowledgeBasePostDetail | undefined>(undefined);
  const [supporterApplicationOpen, setSupporterApplicationOpen] = useState(false);

  // Snackbar
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnack = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, message, severity });

  // Initialize teamId when teams load
  useEffect(() => {
    if (teams.length > 0 && teamId === null) setTeamId(teams[0].id);
  }, [teams, teamId]);

  // Load categories when teamId changes
  useEffect(() => {
    if (!teamId) return;
    setActiveCatId(null);
    fetchCategories(teamId)
      .then(res => {
        setCategories(res.categories);
        setCanManageCategories(res.canManageCategories);
      })
      .catch(() => setCategories([]));
  }, [teamId]);

  // Load posts (debounced on search, immediate on other filters)
  const loadPosts = useCallback(() => {
    if (!teamId) return;
    setLoadingPosts(true);
    fetchPosts(teamId, activeCatId ?? undefined, search || undefined, activeTag ?? undefined)
      .then(res => {
        setPosts(res.posts);
        setCanCreate(res.canCreate);
        setIsSuperAdmin(res.isSuperAdmin ?? false);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false));
  }, [teamId, activeCatId, search, activeTag]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(loadPosts, search ? 400 : 0);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [loadPosts, search]);

  const pinnedPosts = useMemo(() => posts.filter(p => p.isPinned), [posts]);
  const unpinnedPosts = useMemo(() => posts.filter(p => !p.isPinned), [posts]);

  const handleLikeToggle = useCallback(async (postId: number) => {
    setLikingIds(prev => new Set([...prev, postId]));
    try {
      const res = await toggleLike(postId);
      setPosts(prev =>
        prev.map(p => p.id === postId ? { ...p, liked: res.liked, likeCount: res.likeCount } : p),
      );
    } catch {
      showSnack('Like fehlgeschlagen.', 'error');
    } finally {
      setLikingIds(prev => { const next = new Set(prev); next.delete(postId); return next; });
    }
  }, []);

  const handleLikeToggledFromDrawer = useCallback((postId: number, liked: boolean, likeCount: number) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked, likeCount } : p));
  }, []);

  const openPost = (id: number) => {
    setDrawerPostId(id);
    setDrawerOpen(true);
  };

  const openCreate = () => {
    if (!canCreate) {
      setSupporterApplicationOpen(true);
      return;
    }
    setEditPost(undefined);
    setDialogOpen(true);
  };

  const openEdit = (post: KnowledgeBasePostDetail) => {
    if (!canCreate) {
      setSupporterApplicationOpen(true);
      return;
    }
    setDrawerOpen(false);
    setEditPost(post);
    setDialogOpen(true);
  };

  const handlePostSaved = () => {
    loadPosts();
    showSnack(editPost ? 'Beitrag aktualisiert.' : 'Beitrag erstellt.');
  };

  const handlePostDeleted = () => {
    loadPosts();
    showSnack('Beitrag gelöscht.');
  };

  const renderPostGrid = (list: KnowledgeBasePostCard[], emptyLabel: string) => {
    if (loadingPosts) {
      return (
        <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      );
    }
    if (list.length === 0) {
      return (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary">{emptyLabel}</Typography>
        </Box>
      );
    }
    return (
      <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={2}>
        {list.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onOpen={() => openPost(post.id)}
            onLike={() => handleLikeToggle(post.id)}
            onTagClick={tag => { setActiveTag(t => t === tag ? null : tag); }}
            activeTag={activeTag}
            liking={likingIds.has(post.id)}
          />
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto', pb: 10 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>Wissenspool</Typography>
        {teams.length > 1 && (
          <TeamSelect
            teams={teams}
            value={teamId ?? ''}
            onChange={setTeamId}
            size="small"
          />
        )}
        {teams.length === 1 && teamId && (
          <Chip label={teams[0].name} variant="outlined" />
        )}
      </Stack>

      {!teamsLoading && !teamId && (
        <Alert severity="info">Du bist noch in keinem Team.</Alert>
      )}

      {teamId && (
        <>
          {/* Sticky: Category Tabs + Search + Create */}
          <Box
            sx={{
              position: 'sticky',
              top: 'var(--app-header-height)',
              zIndex: t => t.zIndex.appBar - 1,
              bgcolor: 'background.default',
              mx: { xs: -2, md: -3 },
              px: { xs: 2, md: 3 },
              pt: 1,
              pb: 1,
              mb: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Tabs
                value={activeCatId ?? 'all'}
                onChange={(_, v) => setActiveCatId(v === 'all' ? null : v)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{ flex: 1, minHeight: 36, '& .MuiTab-root': { minHeight: 36 } }}
              >
                <Tab label="Alle" value="all" />
                {categories.map(c => (
                  <Tab key={c.id} label={`${c.icon ?? ''}${c.icon ? ' ' : ''}${c.name}`} value={c.id} />
                ))}
              </Tabs>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Suchen…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                    endAdornment: search ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearch('')}><CloseIcon fontSize="small" /></IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                  sx={{ flex: 1, minWidth: { sm: 160 }, maxWidth: { sm: 220 } }}
                />
                <Tooltip title="Beitrag erstellen">
                    <Fab
                      color="primary"
                      size="small"
                      onClick={openCreate}
                      aria-label="Beitrag erstellen"
                      sx={{ flexShrink: 0 }}
                    >
                      <AddIcon />
                    </Fab>
                  </Tooltip>
              </Stack>
            </Stack>
          </Box>

          {/* Active tag filter chip */}
          {activeTag && (
            <Box mb={1.5}>
              <Chip
                label={`#${activeTag}`}
                onDelete={() => setActiveTag(null)}
                color="primary"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Box>
          )}

          {/* Pinned section */}
          {pinnedPosts.length > 0 && (
            <Box mb={3}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                <PushPinIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" color="primary.main">Angepinnte Beiträge</Typography>
              </Stack>
              {renderPostGrid(pinnedPosts, '')}
              {unpinnedPosts.length > 0 && <Divider sx={{ mt: 3 }} />}
            </Box>
          )}

          {/* Main posts */}
          {(unpinnedPosts.length > 0 || loadingPosts) && (
            <Box>
              {pinnedPosts.length > 0 && (
                <Typography variant="subtitle2" color="text.secondary" mb={1.5} mt={2}>
                  Weitere Beiträge
                </Typography>
              )}
              {renderPostGrid(unpinnedPosts, posts.length === 0 ? 'Keine Beiträge vorhanden.' : '')}
            </Box>
          )}

          {!loadingPosts && posts.length === 0 && (
            <Box textAlign="center" py={8}>
              <Typography color="text.secondary">Keine Beiträge vorhanden.</Typography>
              <Button startIcon={<AddIcon />} variant="outlined" sx={{ mt: 2 }} onClick={openCreate}>
                Ersten Beitrag erstellen
              </Button>
            </Box>
          )}
        </>
      )}

      {/* Post Detail Drawer */}
      <PostDetailDrawer
        postId={drawerPostId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={openEdit}
        onDeleted={handlePostDeleted}
        onLikeToggled={handleLikeToggledFromDrawer}
        onTagClick={tag => setActiveTag(t => t === tag ? null : tag)}
        activeTag={activeTag}
      />

      {/* Create / Edit Dialog */}
      <PostFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handlePostSaved}
        teamId={teamId ?? 0}
        teams={teams}
        categories={categories}
        editPost={editPost}
        defaultCategoryId={editPost ? undefined : activeCatId}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>

      {/* Supporter-Rechte beantragen */}
      <SupporterApplicationModal
        open={supporterApplicationOpen}
        onClose={() => setSupporterApplicationOpen(false)}
      />
    </Box>
  );
}
