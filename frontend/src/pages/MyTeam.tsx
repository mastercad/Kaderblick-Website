import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
  Divider,
  Tabs,
  Tab,
  Paper,
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import { EventDetailsModal } from '../modals/EventDetailsModal';
import { apiJson } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import TeamBannerSection from '../components/TeamBannerSection';

interface RelationHint {
  identifier: string;
  name: string;
}

interface PlayerData {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  shirtNumber: string | null;
  mainPosition: { id: number; name: string } | null;
  isMe: boolean;
  myRelation: RelationHint | null;
}

interface CoachData {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  assignmentType: { id: number; name: string } | null;
  isMe: boolean;
  myRelation: RelationHint | null;
}

interface TeamData {
  id: number;
  name: string;
  ageGroup: { id: number; name: string } | null;
  league: { id: number; name: string } | null;
  players: PlayerData[];
  coaches: CoachData[];
  playerCount: number;
  coachCount: number;
  bannerImage?: string | null;
  canEditBanner?: boolean;
}

interface EventData {
  id: number;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  calendarEventType?: {
    name?: string;
    color?: string;
  };
  teamId: number;
  teamName: string;
}

interface TaskData {
  id: number;
  taskId: number;
  title: string;
  description?: string;
  assignedDate?: string;
  status: string;
}

interface MyTeamResponse {
  teams: TeamData[];
  upcomingEvents: EventData[];
  openTasks: TaskData[];
  isCoach: boolean;
  isPlayer: boolean;
}

export default function MyTeam() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [data, setData] = useState<MyTeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);

  useEffect(() => {
    setLoading(true);
    apiJson<MyTeamResponse>('/api/my-team')
      .then((res) => {
        setData(res);
        setTeams(res.teams);
      })
      .catch(() => setError('Team-Daten konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, []);

  const handleBannerChange = useCallback((teamId: number, newBanner: string | null) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, bannerImage: newBanner } : t));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!data || teams.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <GroupsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Kein Team gefunden
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Du bist noch keinem Team zugeordnet. Bitte wende dich an deinen Trainer oder Administrator.
        </Typography>
      </Box>
    );
  }

  const currentTeam = teams[selectedTeamIdx];

  return (
    <Box sx={{ mx: 'auto', p: { xs: 2, md: 3 }, maxWidth: 1200 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <GroupsIcon sx={{ fontSize: 36, color: 'primary.main' }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Mein Team
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Alles rund um {teams.length === 1 ? 'dein Team' : 'deine Teams'} auf einen Blick
          </Typography>
        </Box>
      </Stack>

      {/* Team-Tabs (wenn mehrere Teams) */}
      {teams.length > 1 && (
        <Paper sx={{ mb: 3 }} elevation={0} variant="outlined">
          <Tabs
            value={selectedTeamIdx}
            onChange={(_, newValue) => setSelectedTeamIdx(newValue)}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons={isMobile ? 'auto' : false}
            sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 } }}
          >
            {teams.map((team, idx) => (
              <Tab
                key={team.id}
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{team.name}</span>
                    {team.ageGroup && (
                      <Chip label={team.ageGroup.name} size="small" variant="outlined" />
                    )}
                  </Stack>
                }
              />
            ))}
          </Tabs>
        </Paper>
      )}

      {/* Team Banner */}
      <TeamBannerSection
        teamId={currentTeam.id}
        bannerImage={currentTeam.bannerImage}
        canEditBanner={currentTeam.canEditBanner ?? false}
        onBannerChange={(newBanner) => handleBannerChange(currentTeam.id, newBanner)}
      />

      {/* Team-Info Header */}
      <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}15 100%)` }} elevation={0} variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {currentTeam.name}
              </Typography>
              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                {currentTeam.ageGroup && (
                  <Chip
                    icon={<GroupsIcon />}
                    label={currentTeam.ageGroup.name}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
                {currentTeam.league && (
                  <Chip
                    icon={<EmojiEventsIcon />}
                    label={currentTeam.league.name}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                )}
                <Chip
                  icon={<PersonIcon />}
                  label={`${currentTeam.playerCount} Spieler`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 3,
      }}>

        {/* Kader */}
        <Card variant="outlined" sx={{ gridColumn: { xs: '1', md: '1' } }}>
          <CardContent sx={{ pb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <SportsSoccerIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Kader
              </Typography>
              <Chip label={`${currentTeam.playerCount} Spieler`} size="small" color="primary" />
              {currentTeam.coachCount > 0 && (
                <Chip label={`${currentTeam.coachCount} Trainer`} size="small" color="secondary" variant="outlined" />
              )}
            </Stack>

            <List dense disablePadding>
              {currentTeam.players.map((player, idx) => (
                <React.Fragment key={player.id}>
                  <ListItem
                    sx={{
                      borderRadius: 1,
                      ...(player.isMe && {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '& .MuiListItemText-secondary': { color: 'primary.contrastText', opacity: 0.8 },
                      }),
                      py: 0.5,
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          fontSize: 14,
                          fontWeight: 700,
                          bgcolor: player.isMe ? 'primary.contrastText' : 'primary.main',
                          color: player.isMe ? 'primary.main' : 'primary.contrastText',
                        }}
                      >
                        {player.shirtNumber || '–'}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" sx={{ fontWeight: player.isMe ? 700 : 400 }}>
                            {player.fullName}
                          </Typography>
                          {player.isMe && (
                            <Chip label="Du" size="small" sx={{ height: 20, fontSize: 11, bgcolor: 'primary.contrastText', color: 'primary.main', fontWeight: 700 }} />
                          )}
                          {!player.isMe && player.myRelation && (
                            <Chip label={player.myRelation.name} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                          )}
                        </Stack>
                      }
                      secondary={player.mainPosition?.name || 'Keine Position'}
                    />
                  </ListItem>
                  {idx < currentTeam.players.length - 1 && !player.isMe && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}

              {currentTeam.players.length > 0 && currentTeam.coaches.length > 0 && <Divider sx={{ my: 1 }} />}

              {currentTeam.coaches.map((coach, idx) => (
                <React.Fragment key={`coach-${coach.id}`}>
                  <ListItem
                    sx={{
                      borderRadius: 1,
                      ...(coach.isMe && {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '& .MuiListItemText-secondary': { color: 'primary.contrastText', opacity: 0.8 },
                      }),
                      py: 0.5,
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: coach.isMe ? 'primary.contrastText' : 'secondary.main',
                          color: coach.isMe ? 'primary.main' : 'secondary.contrastText',
                        }}
                      >
                        <PersonIcon sx={{ fontSize: 18 }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" sx={{ fontWeight: coach.isMe ? 700 : 400 }}>
                            {coach.fullName}
                          </Typography>
                          {coach.isMe && (
                            <Chip label="Du" size="small" sx={{ height: 20, fontSize: 11, bgcolor: 'primary.contrastText', color: 'primary.main', fontWeight: 700 }} />
                          )}
                          {!coach.isMe && coach.myRelation && (
                            <Chip label={coach.myRelation.name} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                          )}
                        </Stack>
                      }
                      secondary={coach.assignmentType?.name || 'Trainer'}
                    />
                  </ListItem>
                  {idx < currentTeam.coaches.length - 1 && !coach.isMe && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}

              {currentTeam.players.length === 0 && currentTeam.coaches.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  Noch keine Spieler oder Trainer im Team.
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>

        {/* Rechte Spalte: Termine + Aufgaben */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Nächste Termine */}
          <Card variant="outlined">
            <CardContent sx={{ pb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <CalendarTodayIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Nächste Termine
                </Typography>
              </Stack>

              {data.upcomingEvents.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  Keine anstehenden Termine in den nächsten 30 Tagen.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {data.upcomingEvents
                    .filter(e => e.teamId === currentTeam.id || teams.length === 1)
                    .slice(0, 5)
                    .map((event) => (
                      <ListItem
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        sx={{
                          borderLeft: `4px solid ${event.calendarEventType?.color || theme.palette.primary.main}`,
                          mb: 1,
                          borderRadius: '0 8px 8px 0',
                          bgcolor: 'action.hover',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          '&:hover': {
                            bgcolor: 'action.selected',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: event.calendarEventType?.color || 'primary.main' }}>
                          <CalendarTodayIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {event.title}
                              </Typography>
                              {event.calendarEventType?.name && (
                                <Chip
                                  label={event.calendarEventType.name}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: 11,
                                    bgcolor: event.calendarEventType.color || 'primary.main',
                                    color: '#fff',
                                  }}
                                />
                              )}
                            </Stack>
                          }
                          secondary={
                            <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(event.startDate).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                {' '}
                                {new Date(event.startDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                {event.endDate && (
                                  <> – {new Date(event.endDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</>
                                )}
                              </Typography>
                              {event.location && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                  <LocationOnIcon sx={{ fontSize: 14 }} />
                                  {event.location}
                                </Typography>
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Meine Aufgaben */}
          <Card variant="outlined">
            <CardContent sx={{ pb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <AssignmentIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Meine Aufgaben
                </Typography>
                {data.openTasks.length > 0 && (
                  <Chip label={data.openTasks.length} size="small" color="warning" />
                )}
              </Stack>

              {data.openTasks.length === 0 ? (
                <Box sx={{ py: 2, textAlign: 'center' }}>
                  <StarIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Alles erledigt! Keine offenen Aufgaben.
                  </Typography>
                </Box>
              ) : (
                <List dense disablePadding>
                  {data.openTasks.map((task) => (
                    <ListItem
                      key={task.id}
                      sx={{
                        borderLeft: `4px solid ${theme.palette.warning.main}`,
                        mb: 1,
                        borderRadius: '0 8px 8px 0',
                        bgcolor: 'action.hover',
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <AssignmentIcon fontSize="small" color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {task.title}
                          </Typography>
                        }
                        secondary={
                          <Stack direction="column" spacing={0.5}>
                            {task.description && (
                              <Typography variant="caption" color="text.secondary">
                                {task.description}
                              </Typography>
                            )}
                            {task.assignedDate && (
                              <Typography variant="caption" color="text.secondary">
                                Fällig: {new Date(task.assignedDate).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </Typography>
                            )}
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      <EventDetailsModal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent ? {
          id: selectedEvent.id,
          title: selectedEvent.title,
          start: selectedEvent.startDate,
          end: selectedEvent.endDate || selectedEvent.startDate,
          type: selectedEvent.calendarEventType,
          location: selectedEvent.location ? { name: selectedEvent.location } : undefined,
        } : null}
      />
    </Box>
  );
}
