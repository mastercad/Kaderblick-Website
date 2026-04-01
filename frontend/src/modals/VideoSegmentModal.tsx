import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  IconButton,
  Chip,
  Alert,
  Paper,
  Stack,
  useMediaQuery,
  alpha
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import {
  VideoSegment,
  VideoSegmentInput,
  fetchVideoSegments,
  saveVideoSegment,
  updateVideoSegment,
  deleteVideoSegment,
  exportVideoSegments
} from '../services/videoSegments';
import { Video } from '../services/videos';
import { useToast } from '../context/ToastContext';
import { useTheme } from '@mui/material/styles';

interface VideoSegmentModalProps {
  open: boolean;
  onClose: () => void;
  videos: Video[];
  gameId: number;
}

interface SegmentFormData {
  videoId: number;
  startMinute: string;
  lengthSeconds: string;
  title: string;
  subTitle: string;
  includeAudio: boolean;
}

const emptyFormData: SegmentFormData = {
  videoId: 0,
  startMinute: '0',
  lengthSeconds: '60',
  title: '',
  subTitle: '',
  includeAudio: true
};

export const VideoSegmentModal: React.FC<VideoSegmentModalProps> = ({
  open,
  onClose,
  videos,
  gameId
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { showToast } = useToast();
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<SegmentFormData>(emptyFormData);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (open && videos.length > 0) {
      loadSegments();
    }
  }, [open, gameId]);

  const loadSegments = async () => {
    setLoading(true);
    try {
      const data = await fetchVideoSegments(gameId);
      setSegments(data);
    } catch (error) {
      showToast('Fehler beim Laden der Segmente', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (videoId: number) => {
    setSelectedVideoId(videoId);
    setShowForm(true);
    setFormData({ ...emptyFormData, videoId });
    setEditingId(null);
  };

  const handleEditSegment = (segment: VideoSegment) => {
    setEditingId(segment.id);
    setSelectedVideoId(segment.videoId);
    setShowForm(true);
    setFormData({
      videoId: segment.videoId,
      startMinute: segment.startMinute.toString(),
      lengthSeconds: segment.lengthSeconds.toString(),
      title: segment.title || '',
      subTitle: segment.subTitle || '',
      includeAudio: segment.includeAudio
    });
  };

  const handleSaveSegment = async () => {
    if (!formData.videoId) {
      showToast('Bitte wähle ein Video aus', 'warning');
      return;
    }

    const data: VideoSegmentInput = {
      videoId: formData.videoId,
      startMinute: parseFloat(formData.startMinute.replace(',', '.')),
      lengthSeconds: parseInt(formData.lengthSeconds),
      title: formData.title || null,
      subTitle: formData.subTitle || null,
      includeAudio: formData.includeAudio,
      sortOrder: segments.filter(s => s.videoId === formData.videoId).length
    };

    setLoading(true);
    try {
      if (editingId) {
        await updateVideoSegment(editingId, data);
        showToast('Segment aktualisiert', 'success');
      } else {
        await saveVideoSegment(data);
        showToast('Segment hinzugefügt', 'success');
      }
      setShowForm(false);
      setFormData(emptyFormData);
      setEditingId(null);
      await loadSegments();
    } catch (error) {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSegment = async (id: number) => {
    if (!confirm('Segment wirklich löschen?')) return;

    setLoading(true);
    try {
      await deleteVideoSegment(id);
      showToast('Segment gelöscht', 'success');
      await loadSegments();
    } catch (error) {
      showToast('Fehler beim Löschen', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportVideoSegments(gameId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-segments-${gameId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('Export erfolgreich', 'success');
    } catch (error) {
      showToast('Fehler beim Export', 'error');
    }
  };

  const handleCancelEdit = () => {
    setShowForm(false);
    setFormData(emptyFormData);
    setEditingId(null);
    setSelectedVideoId(null);
  };

  const formatSeconds = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.round(seconds));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSegmentCountLabel = (count: number) => `${count} Segment${count === 1 ? '' : 'e'}`;

  const groupedSegments = segments.reduce((acc, segment) => {
    if (!acc[segment.videoId]) {
      acc[segment.videoId] = [];
    }
    acc[segment.videoId].push(segment);
    return acc;
  }, {} as Record<number, VideoSegment[]>);

  const sortedVideos = [...videos].sort((left, right) => {
    const leftCount = groupedSegments[left.id]?.length || 0;
    const rightCount = groupedSegments[right.id]?.length || 0;

    if (leftCount !== rightCount) {
      return rightCount - leftCount;
    }

    return left.name.localeCompare(right.name, 'de');
  });

  const selectedVideo = videos.find((video) => video.id === selectedVideoId) || null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Video-Schnittliste
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Eigene Clips pro Video verwalten, exportieren und sauber nach Szenen strukturieren.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={segments.length === 0}
              size="small"
              variant="outlined"
              fullWidth={fullScreen}
            >
              Export CSV
            </Button>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 } }}>
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          <Typography variant="body2">
            Wähle zuerst ein Video. Darunter siehst du direkt alle vorhandenen Segmente mit Startzeit, Länge und optionalen Labels.
          </Typography>
        </Alert>

        {/* Video Auswahl */}
        {!showForm && (
          <Stack spacing={1.5}>
            {sortedVideos.map((video) => {
              const videoSegments = (groupedSegments[video.id] || []).slice().sort((left, right) => left.sortOrder - right.sortOrder || left.startMinute - right.startMinute);
              const segmentCount = videoSegments.length;

              return (
                <Paper
                  key={video.id}
                  variant="outlined"
                  sx={{
                    overflow: 'hidden',
                    borderRadius: 3,
                    borderColor: alpha(theme.palette.primary.main, 0.14),
                  }}
                >
                  <Box
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.25,
                      bgcolor: alpha(theme.palette.primary.main, 0.02),
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.25 }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 700,
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'break-word',
                          }}
                        >
                          {video.name}
                        </Typography>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                          <Chip label={getSegmentCountLabel(segmentCount)} size="small" color={segmentCount > 0 ? 'primary' : 'default'} />
                          {video.length ? <Chip label={`Länge ${formatSeconds(video.length)}`} size="small" variant="outlined" /> : null}
                          {video.camera?.name ? <Chip label={video.camera.name} size="small" variant="outlined" /> : null}
                        </Stack>
                      </Box>
                      <Button
                        startIcon={<AddIcon />}
                        onClick={() => handleVideoSelect(video.id)}
                        color="primary"
                        variant="contained"
                        size="small"
                        sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
                      >
                        Neu
                      </Button>
                    </Box>

                    {videoSegments.length > 0 ? (
                      <Stack spacing={1} sx={{ p: { xs: 1.25, sm: 1.5 } }}>
                        {videoSegments.map((segment, index) => (
                          <Paper
                            key={segment.id}
                            variant="outlined"
                            sx={{
                              p: 1.25,
                              borderRadius: 2.5,
                              borderColor: 'divider',
                            }}
                          >
                            <Stack spacing={1}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                                    Segment {index + 1}
                                  </Typography>
                                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                                    <Chip label={`Start ${formatSeconds(segment.startMinute)}`} size="small" />
                                    <Chip label={`Dauer ${formatSeconds(segment.lengthSeconds)}`} size="small" variant="outlined" />
                                    <Chip
                                      label={segment.includeAudio ? 'Mit Ton' : 'Ohne Ton'}
                                      size="small"
                                      color={segment.includeAudio ? 'success' : 'default'}
                                      variant={segment.includeAudio ? 'filled' : 'outlined'}
                                    />
                                  </Stack>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditSegment(segment)}
                                    color="primary"
                                    aria-label="Segment bearbeiten"
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteSegment(segment.id)}
                                    color="error"
                                    aria-label="Segment löschen"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Box>

                              {(segment.title || segment.subTitle) && (
                                <Box sx={{ display: 'grid', gap: 0.5 }}>
                                  {segment.title && (
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        Titel
                                      </Typography>
                                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                        {segment.title}
                                      </Typography>
                                    </Box>
                                  )}
                                  {segment.subTitle && (
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        Untertitel
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                        {segment.subTitle}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              )}
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    ) : (
                      <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            borderRadius: 2.5,
                            borderStyle: 'dashed',
                            color: 'text.secondary',
                          }}
                        >
                          <Typography variant="body2">
                            Für dieses Video gibt es noch keine Segmente.
                          </Typography>
                        </Paper>
                      </Box>
                    )}
                  </Box>
                </Paper>
              );
            })}

            {sortedVideos.length === 0 && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Es sind noch keine Videos für dieses Spiel vorhanden.
                </Typography>
              </Paper>
            )}
          </Stack>
        )}

        {/* Segment Formular */}
        {showForm && (
          <Stack spacing={2}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.primary.main, 0.03),
                borderColor: alpha(theme.palette.primary.main, 0.16),
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Ausgewähltes Video
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-word',
                }}
              >
                {selectedVideo?.name}
              </Typography>
            </Paper>

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
                {editingId ? 'Segment bearbeiten' : 'Neues Segment'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Trage Startpunkt und Dauer ein. Titel und Untertitel helfen später beim Export und bei der Orientierung.
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                fullWidth
                label="Startzeit in Sekunden"
                type="text"
                value={formData.startMinute}
                onChange={(e) => setFormData({ ...formData, startMinute: e.target.value })}
                helperText="Zum Beispiel 125 für 2:05"
              />

              <TextField
                fullWidth
                label="Dauer in Sekunden"
                type="number"
                value={formData.lengthSeconds}
                onChange={(e) => setFormData({ ...formData, lengthSeconds: e.target.value })}
                helperText="Wie lang soll der Clip sein?"
              />
            </Box>

            <TextField
              fullWidth
              label="Titel"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              helperText="Optionaler Titel für bessere Orientierung"
            />

            <TextField
              fullWidth
              label="Untertitel"
              value={formData.subTitle}
              onChange={(e) => setFormData({ ...formData, subTitle: e.target.value })}
              helperText="Optionaler Zusatztext für dieses Segment"
              multiline
              minRows={2}
            />

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
              <FormControlLabel
                sx={{ m: 0, alignItems: 'flex-start' }}
                control={
                  <Switch
                    checked={formData.includeAudio}
                    onChange={(e) => setFormData({ ...formData, includeAudio: e.target.checked })}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Tonspur übernehmen
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Aktivieren, wenn der exportierte Clip Audio enthalten soll.
                    </Typography>
                  </Box>
                }
              />
            </Paper>

            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1}>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancelEdit}
                disabled={loading}
                fullWidth
              >
                Abbrechen
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveSegment}
                disabled={loading}
                fullWidth
              >
                {editingId ? 'Änderungen speichern' : 'Segment anlegen'}
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5 }}>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
};
