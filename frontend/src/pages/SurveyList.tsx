import React, { useEffect, useState } from 'react';
import {
  Card, CardContent, Typography, Box, Button, IconButton, Stack, Tooltip,
  Chip, Avatar, Skeleton, Paper, LinearProgress, Snackbar, Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import BarChartIcon from '@mui/icons-material/BarChart';
import PollIcon from '@mui/icons-material/Poll';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import QuizIcon from '@mui/icons-material/Quiz';
import PeopleIcon from '@mui/icons-material/People';
import EventIcon from '@mui/icons-material/Event';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SurveyCreateWizard from '../modals/SurveyCreateWizard';
import SurveyStatusDialog from './SurveyStatusDialog';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { apiJson } from '../utils/api';

interface Survey {
  id: number;
  title: string;
  description?: string;
  questionCount?: number;
  responseCount?: number;
  dueDate?: string | null;
  hasAnswered?: boolean;
  isPlatform?: boolean;
  canViewStats?: boolean;
}

// --- Helpers ---
function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Abgelaufen';
  if (diffDays === 0) return 'Heute fällig';
  if (diffDays === 1) return 'Morgen fällig';
  if (diffDays <= 7) return `Noch ${diffDays} Tage`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dueDateColor(dateStr: string): 'error' | 'warning' | 'success' | 'default' {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'error';
  if (diffDays <= 2) return 'warning';
  return 'default';
}

// --- SurveyCard ---
const SurveyCard: React.FC<{
  survey: Survey;
  onFill: () => void;
  onStats: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  tooltipOpen: boolean;
}> = ({ survey, onFill, onStats, onEdit, onDelete, onCopyLink, tooltipOpen }) => {
  const isExpired = survey.dueDate ? new Date(survey.dueDate).getTime() < Date.now() : false;
  const answered = survey.hasAnswered ?? false;

  return (
    <Card
      elevation={1}
      sx={{
        borderLeft: 4,
        borderColor: answered ? 'success.main' : isExpired ? 'error.main' : 'primary.main',
        transition: 'box-shadow 0.2s, transform 0.15s',
        '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
        opacity: isExpired && !answered ? 0.7 : 1,
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Icon */}
          <Avatar
            sx={{
              bgcolor: answered ? 'success.light' : isExpired ? 'error.light' : 'primary.light',
              color: 'white',
              width: 44,
              height: 44,
              mt: 0.5,
              flexShrink: 0,
            }}
          >
            {answered ? <CheckCircleIcon /> : <PollIcon />}
          </Avatar>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Title row */}
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
                  {survey.title}
                </Typography>
                {answered && (
                  <Chip size="small" icon={<CheckCircleIcon />} label="Beantwortet" color="success" />
                )}
                {isExpired && !answered && (
                  <Chip size="small" label="Abgelaufen" color="error" variant="outlined" />
                )}
              </Stack>

              {/* Actions */}
              <Stack direction="row" spacing={0} sx={{ flexShrink: 0 }}>
                <Tooltip
                  title="Link kopiert!"
                  open={tooltipOpen}
                  disableFocusListener
                  disableHoverListener
                  disableTouchListener
                  placement="top"
                  arrow
                >
                  <IconButton size="small" color="primary" onClick={e => { e.stopPropagation(); onCopyLink(); }}>
                    <LinkIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Bearbeiten">
                  <IconButton size="small" onClick={e => { e.stopPropagation(); onEdit(); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Löschen">
                  <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); onDelete(); }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            {/* Description */}
            {survey.description && (
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
                {survey.description}
              </Typography>
            )}

            {/* Meta info */}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 0.5, mb: 1.5 }}>
              {survey.questionCount != null && (
                <Chip size="small" icon={<QuizIcon fontSize="small" />} label={`${survey.questionCount} Fragen`} variant="outlined" />
              )}
              {survey.responseCount != null && (
                <Chip size="small" icon={<PeopleIcon fontSize="small" />} label={`${survey.responseCount} Teilnahmen`} variant="outlined" />
              )}
              {survey.dueDate && (
                <Chip
                  size="small"
                  icon={<EventIcon fontSize="small" />}
                  label={formatDueDate(survey.dueDate)}
                  color={dueDateColor(survey.dueDate)}
                  variant="outlined"
                />
              )}
            </Stack>

            {/* Action buttons */}
            <Stack direction="row" spacing={1} alignItems="center">
              {!isExpired && !answered && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<EditNoteIcon />}
                  onClick={e => { e.stopPropagation(); onFill(); }}
                >
                  Jetzt ausfüllen
                </Button>
              )}
              {isExpired && !answered && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditNoteIcon />}
                  onClick={e => { e.stopPropagation(); onFill(); }}
                  color="warning"
                >
                  Nachträglich ausfüllen
                </Button>
              )}
              {answered && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditNoteIcon />}
                  onClick={e => { e.stopPropagation(); onFill(); }}
                  color="inherit"
                >
                  Erneut ausfüllen
                </Button>
              )}
              {survey.canViewStats && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<BarChartIcon />}
                  onClick={e => { e.stopPropagation(); onStats(); }}
                  color="primary"
                >
                  Ergebnisse
                </Button>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

// --- Main ---
const SurveyList: React.FC = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editSurvey, setEditSurvey] = useState<Survey | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);
  const [deleteSurveyId, setDeleteSurveyId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const navigate = useNavigate();
  const [tooltipOpenId, setTooltipOpenId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    setLoading(true);
    apiJson<Survey[]>('/api/surveys')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setSurveys(list);
        setLoading(false);
      })
      .catch(() => {
        setError('Fehler beim Laden der Umfragen');
        setLoading(false);
      });
  }, [reloadFlag]);

  const handleCopyLink = async (surveyId: number) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/survey/fill/${surveyId}`);
      setTooltipOpenId(surveyId);
      setTimeout(() => setTooltipOpenId(null), 1500);
    } catch {
      setSnackbar({ open: true, message: 'Link konnte nicht kopiert werden', severity: 'error' });
    }
  };

  const handleEdit = async (survey: Survey) => {
    try {
      const fullSurvey = await apiJson(`/api/surveys/${survey.id}`);
      setEditSurvey(fullSurvey);
      setWizardOpen(true);
    } catch {
      setSnackbar({ open: true, message: 'Fehler beim Laden der Umfrage', severity: 'error' });
    }
  };

  // Stats
  const answeredCount = surveys.filter(s => s.hasAnswered).length;
  const openCount = surveys.filter(s => !s.hasAnswered).length;

  return (
    <Box p={{ xs: 1, sm: 2, md: 3 }} maxWidth={900} mx="auto">
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}
        sx={{
          position: 'sticky',
          top: { xs: 56, md: 64 },
          zIndex: 10,
          bgcolor: 'background.default',
          pt: 1.5,
          pb: 1.5,
          mb: 1.5,
          mx: { xs: -1.5, sm: -3 },
          px: { xs: 1.5, sm: 3 },
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <PollIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Umfragen</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setWizardOpen(true)} size="medium">
          Neue Umfrage
        </Button>
      </Stack>

      {/* Quick stats */}
      {!loading && surveys.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Paper sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flex: 1 }} elevation={1}>
            <PollIcon color="primary" />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{surveys.length}</Typography>
              <Typography variant="caption" color="text.secondary">Gesamt</Typography>
            </Box>
          </Paper>
          <Paper sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flex: 1 }} elevation={1}>
            <RadioButtonUncheckedIcon color="warning" />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{openCount}</Typography>
              <Typography variant="caption" color="text.secondary">Offen</Typography>
            </Box>
          </Paper>
          <Paper sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flex: 1 }} elevation={1}>
            <CheckCircleIcon color="success" />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{answeredCount}</Typography>
              <Typography variant="caption" color="text.secondary">Beantwortet</Typography>
            </Box>
          </Paper>
        </Stack>
      )}

      {/* Loading */}
      {loading && (
        <Stack spacing={2}>
          {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={110} />)}
        </Stack>
      )}

      {/* Empty state */}
      {!loading && surveys.length === 0 && !error && (
        <Paper sx={{ p: 5, textAlign: 'center' }} elevation={0}>
          <PollIcon sx={{ fontSize: 56, color: 'grey.400', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">Keine Umfragen verfügbar</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            Erstelle eine Umfrage, um Feedback von deinem Team einzuholen.
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setWizardOpen(true)}>
            Erste Umfrage erstellen
          </Button>
        </Paper>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Survey list */}
      {!loading && surveys.length > 0 && (
        <Stack spacing={1.5}>
          {surveys.map(survey => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onFill={() => navigate(`/survey/fill/${survey.id}`)}
              onStats={() => { setSelectedSurveyId(survey.id); setStatusDialogOpen(true); }}
              onEdit={() => handleEdit(survey)}
              onDelete={() => setDeleteSurveyId(survey.id)}
              onCopyLink={() => handleCopyLink(survey.id)}
              tooltipOpen={tooltipOpenId === survey.id}
            />
          ))}
        </Stack>
      )}

      {/* Delete confirmation */}
      <ConfirmationModal
        open={!!deleteSurveyId}
        onClose={() => setDeleteSurveyId(null)}
        onConfirm={async () => {
          if (!deleteSurveyId) return;
          setDeleteLoading(true);
          try {
            await apiJson(`/api/surveys/${deleteSurveyId}`, { method: 'DELETE' });
            setDeleteSurveyId(null);
            setSnackbar({ open: true, message: 'Umfrage gelöscht', severity: 'success' });
            setReloadFlag(f => f + 1);
          } catch {
            setSnackbar({ open: true, message: 'Fehler beim Löschen', severity: 'error' });
            setDeleteSurveyId(null);
          } finally {
            setDeleteLoading(false);
          }
        }}
        title="Umfrage löschen"
        message="Möchtest du diese Umfrage wirklich löschen?"
        confirmText={deleteLoading ? 'Lösche...' : 'Löschen'}
        confirmColor="error"
        cancelText="Abbrechen"
      />

      {/* Status dialog */}
      <SurveyStatusDialog
        surveyId={selectedSurveyId}
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        canViewStats={surveys.find(s => s.id === selectedSurveyId)?.canViewStats}
      />

      {/* Create/Edit wizard */}
      <SurveyCreateWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); setEditSurvey(null); }}
        onSurveyCreated={() => { setWizardOpen(false); setEditSurvey(null); setReloadFlag(f => f + 1); }}
        editSurvey={editSurvey}
      />

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SurveyList;
