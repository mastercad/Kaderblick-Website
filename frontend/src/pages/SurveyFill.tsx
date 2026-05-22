import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiJson } from '../utils/api';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  TextField,
  Slider,
  AppBar,
  Toolbar,
  useTheme
} from '@mui/material';

import KaderblickLogo from '../assets/icon-512.png';

const SurveyFill: React.FC = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [survey, setSurvey] = useState<any>(null);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    apiJson(`/api/surveys/${surveyId}`)
      .then(data => setSurvey(data))
      .catch(() => setError('Umfrage konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [surveyId]);

  const handleChange = (qid: number, value: any) => {
    setAnswers(prev => ({ ...prev, [qid]: value }));
  };

  const handleMultiChange = (qid: number, optId: number) => {
    setAnswers(prev => {
      const arr = Array.isArray(prev[qid]) ? prev[qid] : [];
      if (arr.includes(optId)) {
        return { ...prev, [qid]: arr.filter((id: number) => id !== optId) };
      } else {
        return { ...prev, [qid]: [...arr, optId] };
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    apiJson(`/api/surveys/${surveyId}/submit`, {
      method: 'POST',
      body: { answers }
    })
      .then(() => setSubmitted(true))
      .catch(() => setError('Antworten konnten nicht gespeichert werden.'));
  };

  if (loading) return (
    <Box sx={{
      p: 4
    }}><Typography>Lade Umfrage...</Typography></Box>
  );
  if (error) return (
    <Box sx={{
      p: 4
    }}><Typography color="error">{error}</Typography></Box>
  );
  if (submitted) return (
    <Box sx={{
      p: 4
    }}><Typography variant="h5" color="primary">Vielen Dank für Ihre Teilnahme!</Typography></Box>
  );
  if (!survey) return null;

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: theme.palette.background.default
      }}>
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar>
          <Box
            component="img"
            src={KaderblickLogo}
            alt="Kaderblick"
            sx={{
              height: 40,
              mr: 2
            }} />
          <Typography
            variant="h6"
            sx={{
              color: "inherit",
              flexGrow: 1
            }}>
            Kaderblick – Umfrage
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          mt: 4,
          width: "100%"
        }}>
        <Card sx={{ /* width: '100%',*/ boxShadow: 4 }}>
          <CardContent>
            <Typography variant="h4" gutterBottom sx={{ color: theme.palette.primary.main }}>{survey.title}</Typography>
            {survey.description && (
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mb: 3 }}>{survey.description}</Typography>
            )}
            <form onSubmit={handleSubmit}>
              <Stack spacing={4}>
                {survey.questions.map((q: any, idx: number) => (
                  <Box key={q.id}>
                    <Typography
                      variant="h6"
                      sx={{
                        mb: 1,
                        color: theme.palette.primary.dark
                      }}>{idx + 1}. {q.questionText}</Typography>
                    {/* Fragetypen */}
                    {q.type === 'single_choice' && (
                      <RadioGroup
                        value={answers[q.id] || ''}
                        onChange={e => handleChange(q.id, Number(e.target.value))}
                      >
                        {q.options.map((opt: any) => (
                          <FormControlLabel
                            key={opt.id}
                            value={opt.id}
                            control={<Radio sx={{ color: theme.palette.primary.main, '&.Mui-checked': { color: theme.palette.primary.main } }} />}
                            label={opt.optionText}
                          />
                        ))}
                      </RadioGroup>
                    )}
                    {q.type === 'multiple_choice' && (
                      <Stack direction="row" spacing={2} sx={{
                        flexWrap: "wrap"
                      }}>
                        {q.options.map((opt: any) => (
                          <FormControlLabel
                            key={opt.id}
                            control={
                              <Checkbox
                                checked={Array.isArray(answers[q.id]) && answers[q.id].includes(opt.id)}
                                onChange={() => handleMultiChange(q.id, opt.id)}
                                sx={{ color: theme.palette.primary.main, '&.Mui-checked': { color: theme.palette.primary.main } }}
                              />
                            }
                            label={opt.optionText}
                          />
                        ))}
                      </Stack>
                    )}
                    {q.type === 'text' && (
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        value={answers[q.id] || ''}
                        onChange={e => handleChange(q.id, e.target.value)}
                        variant="outlined"
                        placeholder="Antwort eingeben..."
                        slotProps={{
                          input: {
                            sx: {
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main },
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.dark },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main },
                            }
                          }
                        }}
                      />
                    )}
                    {q.type === 'scale_1_5' && (
                      <Box sx={{
                        px: 2
                      }}>
                        <Slider
                          value={typeof answers[q.id] === 'number' ? answers[q.id] : 3}
                          onChange={(_, val) => handleChange(q.id, val)}
                          step={1}
                          marks
                          min={1}
                          max={5}
                          valueLabelDisplay="auto"
                          sx={{ color: theme.palette.primary.main }}
                        />
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            mx: "auto"
                          }}>
                          {[1,2,3,4,5].map(n => (
                            <Typography key={n} variant="caption">{n}</Typography>
                          ))}
                        </Box>
                      </Box>
                    )}
                    {q.type === 'scale_1_10' && (
                      <Box sx={{
                        px: 2
                      }}>
                        <Slider
                          value={typeof answers[q.id] === 'number' ? answers[q.id] : 5}
                          onChange={(_, val) => handleChange(q.id, val)}
                          step={1}
                          marks
                          min={1}
                          max={10}
                          valueLabelDisplay="auto"
                          sx={{ color: theme.palette.primary.main }}
                        />
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            mx: "auto"
                          }}>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <Typography key={n} variant="caption">{n}</Typography>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))}
                <Button type="submit" variant="contained" color="primary" size="large">
                  Absenden
                </Button>
              </Stack>
            </form>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default SurveyFill;
