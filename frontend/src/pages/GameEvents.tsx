import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
  Fab,
  Container
} from '@mui/material';
import {
  SportsSoccer as SoccerIcon,
  Add as AddIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import { 
  fetchGameDetails,
  fetchGameEvents
} from '../services/games';
import { Game, GameEvent } from '../types/games';
import { GameEventModal } from '../modals/GameEventModal';
import { formatEventTime, formatDateTime } from '../utils/formatter';

interface GameEventsProps {
  gameId: number;
}

export default function GameEvents({ gameId }: GameEventsProps) {
  const [game, setGame] = useState<Game | null>(null);
  const [gameEvents, setGameEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 30 seconds for live updates
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [gameId]);

  const loadData = async () => {
    try {
      setError(null);
      const [gameData, eventsData] = await Promise.all([
        fetchGameDetails(gameId).then(result => result.game),
        fetchGameEvents(gameId)
      ]);
      setGame(gameData);
      setGameEvents(eventsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentGameTime = () => {
    if (!game?.calendarEvent?.startDate) return '';
    const now = new Date();
    const gameStart = new Date(game.calendarEvent.startDate);
    const diffMs = now.getTime() - gameStart.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return diffMinutes > 0 ? `${diffMinutes}'` : "0'";
  };

  const isGameActive = () => {
    if (!game?.calendarEvent?.startDate || !game?.calendarEvent?.endDate) return false;
    const now = new Date();
    const start = new Date(game.calendarEvent.startDate);
    const end = new Date(game.calendarEvent.endDate);
    return now >= start && now <= end;
  };

  const getScore = () => {
    const homeGoals = gameEvents.filter(event => 
      event.gameEventType.code === 'goal' && event.team?.id === game?.homeTeam.id
    ).length;
    const awayGoals = gameEvents.filter(event => 
      event.gameEventType.code === 'goal' && event.team?.id === game?.awayTeam.id
    ).length;
    return { home: homeGoals, away: awayGoals };
  };

  const handleEventSuccess = () => {
    setEventModalOpen(false);
    loadData();
  };

  if (loading && !game) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={loadData}>
          Erneut versuchen
        </Button>
      </Container>
    );
  }

  if (!game) {
    return (
      <Container sx={{ py: 3 }}>
        <Alert severity="info">Spiel nicht gefunden</Alert>
      </Container>
    );
  }

  const score = getScore();

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Live Spielereignisse
        </Typography>
        {isGameActive() && (
          <Chip
            icon={<TimeIcon />}
            label={`Spielzeit: ${getCurrentGameTime()}`}
            color="success"
            variant="filled"
            sx={{ fontSize: '1rem', py: 2, px: 3 }}
          />
        )}
      </Box>

      {/* Game Info Card */}
      <Card sx={{ mb: 3, textAlign: 'center' }}>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            {game.homeTeam.name} vs {game.awayTeam.name}
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Chip 
              label={`${score.home} : ${score.away}`} 
              color="primary" 
              sx={{ fontSize: '2rem', py: 3, px: 4, fontWeight: 'bold' }}
            />
          </Box>

          {game.calendarEvent?.startDate && (
            <Typography variant="body2" color="text.secondary">
              {formatDateTime(game.calendarEvent.startDate)}
            </Typography>
          )}

          {game.location && (
            <Typography variant="body2" color="text.secondary">
              📍 {game.location.name}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SoccerIcon />
            Spielereignisse ({gameEvents.length})
          </Typography>

          {gameEvents.length > 0 ? (
            <List>
              {[...gameEvents].reverse().map((event) => (
                <ListItem
                  key={event.id}
                  sx={{ 
                    borderLeft: `4px solid ${event.team?.id === game.homeTeam.id ? '#1976d2' : '#dc004e'}`,
                    mb: 1,
                    bgcolor: 'background.paper',
                    borderRadius: 1
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Chip 
                          label={game.calendarEvent?.startDate && formatEventTime(event.timestamp, game.calendarEvent.startDate)}
                          size="small"
                          color="primary"
                          variant="filled"
                        />
                        <Typography variant="body1" fontWeight="bold">
                          {event.gameEventType.name}
                        </Typography>
                        {event.player && (
                          <Chip 
                            label={`${event.player.firstName} ${event.player.lastName}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {!event.player && event.coach && (
                          <Chip 
                            label={event.coach}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        <Chip 
                          label={event.team?.name || 'Unbekannt'}
                          size="small"
                          color={event.team?.id === game.homeTeam.id ? 'primary' : 'secondary'}
                        />
                      </Box>
                    }
                    secondary={event.description}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info">
              Noch keine Ereignisse für dieses Spiel erfasst.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Add Event FAB */}
      {isGameActive() && (
        <Fab
          color="primary"
          aria-label="add event"
          sx={{ 
            position: 'fixed', 
            bottom: 24, 
            right: 24,
            zIndex: 1000
          }}
          onClick={() => setEventModalOpen(true)}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Game Event Modal */}
      <GameEventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onSuccess={handleEventSuccess}
        gameId={gameId}
        game={game}
      />
    </Container>
  );
}
