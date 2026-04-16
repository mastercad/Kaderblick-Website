import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Divider,
  Paper,
  LinearProgress,
  Stack,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import PollIcon from '@mui/icons-material/Poll';
import PeopleIcon from '@mui/icons-material/People';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { apiJson } from '../utils/api';
import EmptyStateHint from '../components/EmptyStateHint';
import SurveyStatsPanel from '../components/SurveyStatsPanel';

interface SurveyStatusDialogProps {
  surveyId: number | null;
  open: boolean;
  onClose: () => void;
  canViewStats?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  single_choice: 'Einzelauswahl',
  multiple_choice: 'Mehrfachauswahl',
  text: 'Freitext',
  scale_1_5: 'Skala 1–5',
  scale_1_10: 'Skala 1–10',
};

const TYPE_COLORS: Record<string, 'primary' | 'secondary' | 'info' | 'success' | 'warning'> = {
  single_choice: 'primary',
  multiple_choice: 'secondary',
  text: 'info',
  scale_1_5: 'warning',
  scale_1_10: 'warning',
};

const SurveyStatusDialog: React.FC<SurveyStatusDialogProps> = ({ surveyId, open, onClose, canViewStats = false }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<any>(null);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (!open || !surveyId) return;
    setLoading(true);
    setError(null);
    setResults(null);

    apiJson(`/api/surveys/${surveyId}`)
      .then(setSurvey)
      .catch(() => setError('Fehler beim Laden der Umfrage'));

    // Only fetch /results when user has no stats access (stats panel has its own data)
    if (!canViewStats) {
      apiJson(`/api/surveys/${surveyId}/results`)
        .then(setResults)
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [open, surveyId, canViewStats]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Umfrage-Status</DialogTitle>
      <DialogContent>
        {loading && <CircularProgress />}
        {error && <Alert severity="error">{error}</Alert>}
        {survey && (
          <Box>
            <Typography variant="h6" mb={1}>{survey.title}</Typography>
            {survey.description && (
              <Typography color="text.secondary" mb={2}>{survey.description}</Typography>
            )}

            {canViewStats && surveyId ? (
              <SurveyStatsPanel surveyId={surveyId} />
            ) : (
              <>
                <Divider sx={{ my: 2 }} />
                <ResultsView results={results} />
              </>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** Professionally styled results view */
const ResultsView: React.FC<{ results: any }> = ({ results }) => {
  if (!results) return null;

  const totalResponses: number = results.answers_total ?? 0;

  return (
    <Box>
      {/* Summary header */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PeopleIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight="bold">
            {totalResponses} {totalResponses === 1 ? 'Teilnahme' : 'Teilnahmen'}
          </Typography>
        </Stack>
      </Paper>

      {results.results.length === 0 && (
        <EmptyStateHint
          icon={<PollIcon />}
          title="Noch keine Auswertungsdaten"
          description="Bisher haben noch keine Teilnehmer abgestimmt."
          compact
        />
      )}

      {/* Per-question results */}
      {results.results.map((q: any, idx: number) => {
        const typeName = TYPE_LABELS[q.type] || q.type;
        const typeColor = TYPE_COLORS[q.type] || 'primary';
        const totalForQuestion = computeTotalForQuestion(q, totalResponses);

        return (
          <Accordion key={q.id} defaultExpanded variant="outlined" sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%', pr: 1 }}>
                <PollIcon fontSize="small" color={typeColor} />
                <Typography variant="body1" fontWeight="bold" sx={{ flex: 1 }}>
                  {idx + 1}. {q.questionText}
                </Typography>
                <Chip label={typeName} size="small" color={typeColor} variant="outlined" />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              {/* Choice questions: horizontal bars with percentages */}
              {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                <ChoiceResults options={q.options} total={totalForQuestion} />
              )}

              {/* Scale questions: distribution + average */}
              {(q.type === 'scale_1_5' || q.type === 'scale_1_10') && (
                <ScaleResults question={q} totalResponses={totalResponses} />
              )}

              {/* Text questions */}
              {q.type === 'text' && (
                <TextResults answers={q.answers} />
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};

/** Compute total responses for a question (for percentage calculation) */
function computeTotalForQuestion(q: any, totalResponses: number): number {
  if (q.options && q.options.length > 0) {
    // For single_choice, total = sum of option counts
    // For multiple_choice, total = totalResponses (a user could pick many)
    if (q.type === 'single_choice') {
      return q.options.reduce((sum: number, opt: any) => sum + (opt.count || 0), 0);
    }
    return totalResponses;
  }
  return totalResponses;
}

/** Choice question results with progress bars */
const ChoiceResults: React.FC<{ options: any[]; total: number }> = ({ options, total }) => {
  if (!options || options.length === 0) {
    return <Typography variant="body2" color="text.secondary">Keine Antwortoptionen vorhanden.</Typography>;
  }

  const maxCount = Math.max(...options.map((o: any) => o.count || 0), 1);

  return (
    <Box>
      {options.map((opt: any) => {
        const count = opt.count || 0;
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        const isMax = count === maxCount && count > 0;

        return (
          <Box key={opt.id} sx={{ mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={0.25}>
              <Typography
                variant="body2"
                fontWeight={isMax ? 'bold' : 'normal'}
                color={isMax ? 'text.primary' : 'text.secondary'}
              >
                {opt.optionText || `Option ${opt.id}`}
              </Typography>
              <Typography variant="body2" fontWeight="bold" sx={{ ml: 2, whiteSpace: 'nowrap' }}>
                {count} {count === 1 ? 'Stimme' : 'Stimmen'} ({percentage}%)
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={percentage}
              color={isMax ? 'primary' : 'inherit'}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  ...(isMax ? {} : { backgroundColor: 'text.disabled' }),
                },
              }}
            />
          </Box>
        );
      })}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Gesamt: {total} {total === 1 ? 'Antwort' : 'Antworten'}
      </Typography>
    </Box>
  );
};

/** Scale question results with distribution and average */
const ScaleResults: React.FC<{ question: any; totalResponses: number }> = ({ question, totalResponses }) => {
  const rawAnswers = question.answers;

  // rawAnswers for scale is just the sum (number), or could be a distribution object
  if (typeof rawAnswers === 'number') {
    const average = totalResponses > 0 ? (rawAnswers / totalResponses).toFixed(2) : '–';
    const maxScale = question.type === 'scale_1_5' ? 5 : 10;
    const avgNum = totalResponses > 0 ? rawAnswers / totalResponses : 0;
    const percentage = (avgNum / maxScale) * 100;

    return (
      <Box>
        {/* Options if available */}
        {question.options && question.options.length > 0 && (
          <Box mb={2}>
            {question.options.map((opt: any) => {
              const count = opt.count || 0;
              const pct = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
              return (
                <Box key={opt.id} sx={{ mb: 1 }}>
                  <Stack direction="row" justifyContent="space-between" mb={0.25}>
                    <Typography variant="body2">{opt.optionText || opt.id}</Typography>
                    <Typography variant="body2" fontWeight="bold">{count} ({pct}%)</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    color="warning"
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              );
            })}
          </Box>
        )}

        {/* Average display */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(255,167,38,0.08) 0%, rgba(255,167,38,0.02) 100%)',
          }}
        >
          <Typography variant="caption" color="text.secondary">Durchschnitt</Typography>
          <Typography variant="h4" fontWeight="bold" color="warning.main">
            {average}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            von {maxScale} ({totalResponses} {totalResponses === 1 ? 'Antwort' : 'Antworten'})
          </Typography>
          <LinearProgress
            variant="determinate"
            value={percentage}
            color="warning"
            sx={{ height: 6, borderRadius: 3, mt: 1 }}
          />
        </Paper>
      </Box>
    );
  }

  return (
    <Typography variant="body2" color="text.secondary">Keine Skalendaten verfügbar.</Typography>
  );
};

/** Text question results */
const TextResults: React.FC<{ answers: any }> = ({ answers }) => {
  // answers for text is an array of strings
  const textList = Array.isArray(answers) ? answers : [];

  if (textList.length === 0) {
    return (
      <EmptyStateHint
        icon={<PollIcon />}
        title="Noch keine Textantworten"
        description="Bisher wurden keine Textantworten eingereicht."
        compact
      />
    );
  }

  return (
    <Stack spacing={1}>
      {textList.map((ans: string, i: number) => (
        <Paper
          key={i}
          variant="outlined"
          sx={{
            p: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            backgroundColor: 'action.hover',
          }}
        >
          <FormatQuoteIcon fontSize="small" color="disabled" sx={{ mt: 0.25, flexShrink: 0 }} />
          <Typography variant="body2">{ans}</Typography>
        </Paper>
      ))}
      <Typography variant="caption" color="text.secondary">
        {textList.length} {textList.length === 1 ? 'Antwort' : 'Antworten'}
      </Typography>
    </Stack>
  );
};

export default SurveyStatusDialog;
