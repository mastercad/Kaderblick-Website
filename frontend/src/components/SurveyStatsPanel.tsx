import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  LinearProgress,
  Divider,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import GroupIcon from '@mui/icons-material/Group';
import PollIcon from '@mui/icons-material/Poll';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { apiJson } from '../utils/api';

interface Participant {
  userId: number;
  firstName: string;
  lastName: string;
  respondedAt: string | null;
}

interface NonParticipant {
  userId: number;
  firstName: string;
  lastName: string;
}

interface QuestionOption {
  id: number;
  optionText: string;
  count: number;
  percentage: number;
}

interface QuestionStat {
  id: number;
  questionText: string;
  type: string;
  options: QuestionOption[];
  scaleAverage?: number;
  textAnswers?: string[];
}

interface TargetGroup {
  type: string;
  label?: string;
  items?: { id: number; name: string }[];
}

interface SurveyStats {
  surveyId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  isExpired: boolean;
  targetGroup: TargetGroup;
  totalTargeted: number;
  totalResponded: number;
  totalNotResponded: number;
  participationRate: number;
  participants: Participant[];
  nonParticipants: NonParticipant[];
  timeline: Record<string, number>;
  questionStats: QuestionStat[];
  remindersSent: string[];
  initialNotificationSent: boolean;
}

interface SurveyStatsPanelProps {
  surveyId: number;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    single_choice: 'Einzelauswahl',
    multiple_choice: 'Mehrfachauswahl',
    text: 'Freitext',
    scale_1_5: 'Skala 1–5',
    scale_1_10: 'Skala 1–10',
  };
  return typeMap[type] || type;
}

function getReminderLabel(key: string): string {
  const labels: Record<string, string> = {
    '7_days': '7 Tage vorher',
    '3_days': '3 Tage vorher',
    '1_day': '1 Tag vorher',
    '3_hours': '3 Stunden vorher',
  };
  return labels[key] || key;
}

const SurveyStatsPanel: React.FC<SurveyStatsPanelProps> = ({ surveyId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SurveyStats | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiJson<SurveyStats>(`/api/surveys/${surveyId}/stats`)
      .then(setStats)
      .catch(() => setError('Fehler beim Laden der Statistiken.'))
      .finally(() => setLoading(false));
  }, [surveyId]);

  if (loading) return (
    <Box
      sx={{
        textAlign: "center",
        py: 3
      }}><CircularProgress size={28} /></Box>
  );
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!stats) return null;

  const rateColor = stats.participationRate >= 75 ? 'success' : stats.participationRate >= 40 ? 'warning' : 'error';

  return (
    <Box>
      {/* Participation Overview */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            mb: 1
          }}>
          <GroupIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{
            fontWeight: "bold"
          }}>Beteiligung</Typography>
        </Stack>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={stats.participationRate}
              color={rateColor}
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: "bold",
              minWidth: 50
            }}>
            {stats.participationRate}%
          </Typography>
        </Box>

        <Stack direction="row" spacing={2} sx={{
          flexWrap: "wrap"
        }}>
          <Chip
            icon={<GroupIcon />}
            label={`${stats.totalTargeted} Zielgruppe`}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<CheckCircleIcon />}
            label={`${stats.totalResponded} teilgenommen`}
            size="small"
            color="success"
            variant="outlined"
          />
          <Chip
            icon={<CancelIcon />}
            label={`${stats.totalNotResponded} ausstehend`}
            size="small"
            color={stats.totalNotResponded > 0 ? 'warning' : 'default'}
            variant="outlined"
          />
        </Stack>
      </Paper>
      {/* Target Group & Due Date */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={3} sx={{
          flexWrap: "wrap"
        }}>
          <Box>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>Zielgruppe</Typography>
            <Typography variant="body2">
              {stats.targetGroup.type === 'platform'
                ? stats.targetGroup.label
                : stats.targetGroup.items?.map(i => i.name).join(', ') || '–'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>Fälligkeitsdatum</Typography>
            <Typography variant="body2">
              {stats.dueDate ? formatDate(stats.dueDate) : 'Kein Fälligkeitsdatum'}
              {stats.isExpired && (
                <Chip label="Abgelaufen" size="small" color="error" sx={{ ml: 1 }} />
              )}
            </Typography>
          </Box>
        </Stack>
      </Paper>
      {/* Timeline */}
      {Object.keys(stats.timeline).length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: "bold",
              mb: 1
            }}>Teilnahme-Verlauf</Typography>
          <Stack direction="row" spacing={2} sx={{
            flexWrap: "wrap"
          }}>
            {Object.entries(stats.timeline).map(([date, count]) => (
              <Chip
                key={date}
                label={`${formatDate(date)}: ${count}`}
                size="small"
                variant="outlined"
                color="primary"
              />
            ))}
          </Stack>
        </Paper>
      )}
      {/* Question Stats */}
      {stats.questionStats.length > 0 && (
        <Box sx={{
          mb: 2
        }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              mb: 1
            }}>
            <PollIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{
              fontWeight: "bold"
            }}>Auswertung pro Frage</Typography>
          </Stack>

          {stats.questionStats.map((q, idx) => (
            <Accordion key={q.id} defaultExpanded={idx === 0} variant="outlined" sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">
                  <b>{idx + 1}. {q.questionText}</b>
                  <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>({getTypeName(q.type)})</span>
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {/* Choice-based questions: bar chart style */}
                {(q.type === 'single_choice' || q.type === 'multiple_choice') && q.options.length > 0 && (
                  <Box>
                    {q.options.map(opt => (
                      <Box key={opt.id} sx={{ mb: 1 }}>
                        <Stack
                          direction="row"
                          sx={{
                            justifyContent: "space-between",
                            mb: 0.25
                          }}>
                          <Typography variant="body2">{opt.optionText || `Option ${opt.id}`}</Typography>
                          <Typography variant="body2" sx={{
                            fontWeight: "bold"
                          }}>{opt.count} ({opt.percentage}%)</Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={opt.percentage}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Scale questions */}
                {(q.type === 'scale_1_5' || q.type === 'scale_1_10') && (
                  <Box>
                    {q.options.length > 0 && q.options.map(opt => (
                      <Box key={opt.id} sx={{ mb: 1 }}>
                        <Stack
                          direction="row"
                          sx={{
                            justifyContent: "space-between",
                            mb: 0.25
                          }}>
                          <Typography variant="body2">{opt.optionText || `${opt.id}`}</Typography>
                          <Typography variant="body2" sx={{
                            fontWeight: "bold"
                          }}>{opt.count} ({opt.percentage}%)</Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={opt.percentage}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    ))}
                    {q.scaleAverage !== undefined && (
                      <Typography variant="body2" sx={{
                        mt: 1
                      }}>
                        <b>Durchschnitt:</b> {q.scaleAverage}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Text questions */}
                {q.type === 'text' && q.textAnswers && (
                  <Box>
                    {q.textAnswers.length === 0 ? (
                      <Typography variant="body2" sx={{
                        color: "text.secondary"
                      }}>Keine Antworten vorhanden.</Typography>
                    ) : (
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {q.textAnswers.map((ans, i) => (
                          <li key={i}>
                            <Typography variant="body2">{ans}</Typography>
                          </li>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
      {/* Participants Table */}
      <Accordion variant="outlined" sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">
            <CheckCircleIcon fontSize="inherit" color="success" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
            Teilgenommen ({stats.participants.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          {stats.participants.length === 0 ? (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                p: 2
              }}>
              Noch keine Teilnahmen.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Teilgenommen am</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.participants.map(p => (
                    <TableRow key={p.userId}>
                      <TableCell>{p.firstName} {p.lastName}</TableCell>
                      <TableCell>{formatDateTime(p.respondedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </AccordionDetails>
      </Accordion>
      {/* Non-Participants Table */}
      <Accordion variant="outlined" sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">
            <CancelIcon fontSize="inherit" color="warning" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
            Noch nicht teilgenommen ({stats.nonParticipants.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          {stats.nonParticipants.length === 0 ? (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                p: 2
              }}>
              Alle Benutzer haben bereits teilgenommen.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.nonParticipants.map(p => (
                    <TableRow key={p.userId}>
                      <TableCell>{p.firstName} {p.lastName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </AccordionDetails>
      </Accordion>
      {/* Notification Info */}
      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            mb: 1
          }}>
          <NotificationsActiveIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{
            fontWeight: "bold"
          }}>Benachrichtigungen</Typography>
        </Stack>
        <Typography variant="body2">
          Erstbenachrichtigung: {stats.initialNotificationSent
            ? <Chip label="Gesendet" size="small" color="success" />
            : <Chip label="Nicht gesendet" size="small" color="default" />}
        </Typography>
        {stats.remindersSent && stats.remindersSent.length > 0 ? (
          <Box sx={{
            mt: 1
          }}>
            <Typography variant="body2">Erinnerungen gesendet:</Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                mt: 0.5,
                flexWrap: "wrap"
              }}>
              {stats.remindersSent.map(r => (
                <Chip key={r} label={getReminderLabel(r)} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>
        ) : (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mt: 0.5
            }}>
            Noch keine Erinnerungen gesendet.
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default SurveyStatsPanel;
