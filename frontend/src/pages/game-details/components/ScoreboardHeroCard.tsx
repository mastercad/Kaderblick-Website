import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  PlayArrow as LiveIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Sync as SyncIcon,
  SportsScore as SportsScoreIcon,
  CheckCircle as CheckCircleIcon,
  EmojiEvents as LeagueIcon,
} from '@mui/icons-material';
import { Game } from '../../../types/games';
import { WeatherDisplay } from '../../../components/WeatherIcons';
import Location from '../../../components/Location';
import { formatDateNice, formatTimeNice } from '../formatters';

interface ScoreboardHeroCardProps {
  game: Game;
  homeScore: number | null;
  awayScore: number | null;
  isGameRunning: boolean;
  isFinished: boolean;
  syncing: boolean;
  finishing: boolean;
  onSyncFussballDe: () => void;
  onOpenWeatherModal: (eventId: number | null) => void;
  onFinishGame: () => void;
}

const ScoreboardHeroCard = ({
  game,
  homeScore,
  awayScore,
  isGameRunning,
  isFinished,
  syncing,
  finishing,
  onSyncFussballDe,
  onOpenWeatherModal,
  onFinishGame,
}: ScoreboardHeroCardProps) => {
  const theme = useTheme();

  return (
    <Card sx={{
      mb: 3,
      overflow: 'hidden',
      position: 'relative',
      border: isGameRunning ? `2px solid ${theme.palette.success.main}` : '1px solid',
      borderColor: isGameRunning ? 'success.main' : 'divider',
    }}>
      {/* Competition label – top right */}
      {(game.league || game.cup || game.gameType) && (
        <Box sx={{
          position: 'absolute',
          top: isGameRunning ? 32 : 0,
          right: 0,
          zIndex: 1,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 0.4,
          px: 1,
          py: 0.4,
          bgcolor: game.league
            ? alpha(theme.palette.primary.main, 0.08)
            : game.cup
              ? alpha(theme.palette.secondary.main, 0.08)
              : alpha(theme.palette.text.secondary, 0.08),
          borderRadius: '0 0 0 8px',
          maxWidth: { xs: '55%', sm: '50%' },
        }}>
          <LeagueIcon sx={{
            fontSize: '0.65rem',
            color: game.league ? 'primary.main' : game.cup ? 'secondary.main' : 'text.secondary',
            flexShrink: 0,
          }} />
          <Typography sx={{
            fontSize: '0.65rem',
            fontWeight: 600,
            color: game.league ? 'primary.main' : game.cup ? 'secondary.main' : 'text.secondary',
            lineHeight: 1.35,
            letterSpacing: 0.2,
          }}>
            {game.league?.name ?? game.cup?.name ?? game.gameType?.name}
          </Typography>
        </Box>
      )}

      {/* Live banner */}
      {isGameRunning && (
        <Box sx={{
          bgcolor: 'success.main',
          color: 'success.contrastText',
          px: 2,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}>
          <LiveIcon sx={{ fontSize: 16, animation: 'pulse 1.5s infinite' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.7rem' }}>
            Live
          </Typography>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </Box>
      )}

      <CardContent sx={{ px: { xs: 2, sm: 4 }, py: { xs: 2.5, sm: 3 } }}>
        {/* Scoreboard: Home - Score - Away */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 1.5, sm: 3 },
          mb: 2,
        }}>
          {/* Home Team */}
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography sx={{
              fontWeight: 700,
              fontSize: { xs: '1rem', sm: '1.3rem' },
              lineHeight: 1.3,
              wordBreak: 'break-word',
            }}>
              {game.homeTeam.name}
            </Typography>
          </Box>

          {/* Score */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: { xs: 80, sm: 120 },
            flexShrink: 0,
          }}>
            {homeScore !== null && awayScore !== null ? (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0.75, sm: 1 },
                bgcolor: isGameRunning
                  ? alpha(theme.palette.success.main, 0.1)
                  : alpha(theme.palette.primary.main, 0.06),
                borderRadius: 2,
                px: { xs: 1.5, sm: 2.5 },
                py: { xs: 0.75, sm: 1 },
              }}>
                <Typography sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.6rem', sm: '2.2rem' },
                  lineHeight: 1,
                  color: isGameRunning ? 'success.main' : 'text.primary',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {homeScore}
                </Typography>
                <Typography sx={{
                  fontWeight: 300,
                  fontSize: { xs: '1.2rem', sm: '1.6rem' },
                  color: 'text.secondary',
                }}>
                  :
                </Typography>
                <Typography sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.6rem', sm: '2.2rem' },
                  lineHeight: 1,
                  color: isGameRunning ? 'success.main' : 'text.primary',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {awayScore}
                </Typography>
              </Box>
            ) : (
              <Typography sx={{
                fontWeight: 600,
                fontSize: '0.8rem',
                color: 'text.disabled',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
                vs
              </Typography>
            )}
          </Box>

          {/* Away Team */}
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography sx={{
              fontWeight: 700,
              fontSize: { xs: '1rem', sm: '1.3rem' },
              lineHeight: 1.3,
              wordBreak: 'break-word',
            }}>
              {game.awayTeam.name}
            </Typography>
          </Box>
        </Box>

        {/* Meta Info Bar */}
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 0.75, sm: 1.5 },
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 2,
        }}>
          {game.calendarEvent?.startDate && (
            <Chip
              icon={<CalendarIcon sx={{ fontSize: '0.9rem !important' }} />}
              label={formatDateNice(game.calendarEvent.startDate)}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.8rem', height: 30, '& .MuiChip-icon': { ml: 0.5 } }}
            />
          )}
          {game.calendarEvent?.startDate && (
            <Chip
              icon={<TimeIcon sx={{ fontSize: '0.9rem !important' }} />}
              label={`${formatTimeNice(game.calendarEvent.startDate)}${game.calendarEvent.endDate ? ` – ${formatTimeNice(game.calendarEvent.endDate)}` : ''} Uhr`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.8rem', height: 30, '& .MuiChip-icon': { ml: 0.5 } }}
            />
          )}
          {game.location && (
            <Box sx={{ display: 'inline-flex', '& a': { fontSize: '0.8rem' }, '& svg': { fontSize: '1rem !important' } }}>
              <Location
                id={game.location.id}
                name={game.location.name}
                latitude={game.location.latitude}
                longitude={game.location.longitude}
                address={game.location.address}
              />
            </Box>
          )}
          <Box
            onClick={() => onOpenWeatherModal(game.calendarEvent?.id ?? null)}
            sx={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              '&:hover': { opacity: 0.7 },
            }}
            title="Wetterdetails anzeigen"
          >
            <WeatherDisplay
              code={game.weatherData?.dailyWeatherData?.weathercode?.[0]}
              theme={'light'}
              size={30}
            />
          </Box>
        </Box>

        {/* Fussball.de Sync */}
        {game.fussballDeUrl && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={onSyncFussballDe}
              disabled={syncing}
              size="small"
            >
              {syncing ? 'Synchronisiere...' : 'Mit Fussball.de synchronisieren'}
            </Button>
          </Box>
        )}

        {/* Spiel beenden / beendet */}
        {(game?.permissions?.can_finish_game ?? false) && !isFinished && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<SportsScoreIcon />}
              onClick={onFinishGame}
              disabled={finishing}
              size="small"
            >
              {finishing ? 'Wird beendet...' : 'Spiel beenden'}
            </Button>
          </Box>
        )}
        {isFinished && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, mt: 2 }}>
            <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
              Spiel beendet
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ScoreboardHeroCard;
