import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  Divider,
  IconButton,
  Collapse,
  alpha,
  useTheme,
} from '@mui/material';
import {
  VideoLibrary as VideoIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCut as ContentCutIcon,
} from '@mui/icons-material';
import YouTubeIcon from '@mui/icons-material/YouTube';
import { Video } from '../../../services/videos';
import { formatVideoLength } from '../formatters';
import DetailSectionHeader from './DetailSectionHeader';

interface VideosSectionProps {
  videos: Video[];
  sectionsOpen: boolean;
  canCreateVideos: boolean;
  hasUser: boolean;
  onToggle: () => void;
  onProtectedVideoAction: () => void;
  onOpenSegmentModal: () => void;
  onPlayVideo: (video: Video) => void;
  onEditVideo: (video: Video) => void;
  onDeleteVideo: (video: Video) => void;
}

const VideosSection = ({
  videos,
  sectionsOpen,
  canCreateVideos,
  hasUser,
  onToggle,
  onProtectedVideoAction,
  onOpenSegmentModal,
  onPlayVideo,
  onEditVideo,
  onDeleteVideo,
}: VideosSectionProps) => {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 3 }}>
      <DetailSectionHeader
        icon={<VideoIcon sx={{ color: 'primary.main', fontSize: 22 }} />}
        label="Videos"
        count={videos.length}
        color={theme.palette.primary.main}
        open={sectionsOpen}
        onToggle={onToggle}
        testId="videos-section-header"
        action={(
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {videos.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<ContentCutIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
                size="small"
                onClick={onOpenSegmentModal}
                sx={{ fontSize: '0.8rem', minWidth: { xs: 32, sm: 'auto' }, px: { xs: 1, sm: 1.5 } }}
                aria-label="Schnittliste"
              >
                <ContentCutIcon sx={{ display: { xs: 'inline-flex', sm: 'none' }, fontSize: '1.1rem' }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Schnittliste</Box>
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<VideoIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
              size="small"
              onClick={onProtectedVideoAction}
              sx={{ fontSize: '0.8rem', minWidth: { xs: 32, sm: 'auto' }, px: { xs: 1, sm: 1.5 } }}
              aria-label="Video hinzufügen"
            >
              <VideoIcon sx={{ display: { xs: 'inline-flex', sm: 'none' }, fontSize: '1.1rem' }} />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Video hinzufügen</Box>
            </Button>
          </Box>
        )}
      />
      <Collapse in={sectionsOpen} timeout="auto" unmountOnExit>
        <Card className="gamevideos-mobile-card" sx={{ overflow: 'hidden' }}>
          <CardContent sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1, sm: 2 } }}>
            {videos.length > 0 ? (
              <Stack spacing={0} divider={<Divider sx={{ mx: -1.5 }} />}>
                {videos.map((video) => (
                  <Box
                    key={video.id}
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 1, sm: 2 },
                      py: 1.5,
                      px: { xs: 0.5, sm: 1 },
                      alignItems: { xs: 'stretch', sm: 'flex-start' },
                      '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.5) },
                      borderRadius: 1,
                    }}
                  >
                    {/* Thumbnail */}
                    {video.youtubeId && (
                      <Box
                        sx={{
                          flexShrink: 0,
                          width: { xs: '100%', sm: 140 },
                          maxWidth: { xs: '100%', sm: 140 },
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          position: 'relative',
                          cursor: 'pointer',
                          aspectRatio: '16/9',
                          '&:hover': { opacity: 0.9 },
                        }}
                        onClick={() => onPlayVideo(video)}
                      >
                        <img
                          src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                          alt={video.name}
                          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
                        />
                        <Box sx={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'rgba(0,0,0,0.25)',
                          transition: 'background-color 0.2s',
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.4)' },
                        }}>
                          <YouTubeIcon sx={{ fontSize: { xs: 44, sm: 32 }, color: '#fff', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }} />
                        </Box>
                      </Box>
                    )}

                    {/* Info + Actions */}
                    <Box sx={{ display: 'flex', flex: 1, minWidth: 0 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontWeight: 700,
                            fontSize: { xs: '0.9rem', sm: '0.95rem' },
                            lineHeight: 1.3,
                            cursor: 'pointer',
                            color: 'primary.main',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                          onClick={() => onPlayVideo(video)}
                        >
                          {video.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                          {video.videoType?.name && (
                            <Chip label={video.videoType.name} size="small" sx={{ height: 22, fontSize: '0.72rem' }} />
                          )}
                          {video.length != null && video.length > 0 && (
                            <Chip label={formatVideoLength(video.length)} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem' }} />
                          )}
                          {video.camera?.name && (
                            <Chip label={video.camera.name} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem' }} />
                          )}
                        </Box>
                        {video.filePath && (
                          <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
                            {video.filePath}
                          </Typography>
                        )}
                        {hasUser && (
                          <Box sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            gap: 0.25,
                            mt: 0.5,
                            opacity: { xs: 1, sm: 0.4 },
                            transition: 'opacity 0.2s',
                            'div:hover &': { opacity: 1 },
                          }}>
                            <IconButton size="small" onClick={() => onPlayVideo(video)} sx={{ p: 0.5 }}>
                              <YouTubeIcon sx={{ fontSize: 18, color: 'error.main' }} />
                            </IconButton>
                            {canCreateVideos && (
                              <>
                                <IconButton size="small" onClick={() => onEditVideo(video)} sx={{ p: 0.5 }}>
                                  <EditIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                                <IconButton size="small" onClick={() => onDeleteVideo(video)} sx={{ p: 0.5 }}>
                                  <DeleteIcon sx={{ fontSize: 18, color: 'error.main' }} />
                                </IconButton>
                              </>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <VideoIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary" variant="body2">
                  Keine Videos für dieses Spiel.
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Collapse>
    </Box>
  );
};

export default VideosSection;
