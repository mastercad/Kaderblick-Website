import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, Divider, Stack, Typography,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import FlagIcon from '@mui/icons-material/Flag';
import LoginIcon from '@mui/icons-material/Login';
import RefreshIcon from '@mui/icons-material/Refresh';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { fetchPublicLiveTicker, PublicLiveTickerData, PublicTickerEvent } from '../services/publicLiveTicker';
import { ApiError } from '../utils/api';

const REFRESH_INTERVAL = 20_000;

function EventIcon({ event }: { event: PublicTickerEvent }) {
  const code = event.type.code.toLowerCase();
  if (code.includes('goal')) return <SportsSoccerIcon />;
  if (code.includes('card')) return <FlagIcon />;
  if (code.includes('substitution')) return <SwapHorizIcon />;
  return <CampaignIcon />;
}

function statusLabel(status: PublicLiveTickerData['game']['status']) {
  if (status === 'live') return 'LIVE';
  if (status === 'finished') return 'Beendet';
  return 'Geplant';
}

function TickerBrandHeader() {
  return (
    <Box
      component="header"
      sx={{
        bgcolor: '#0b0e0c',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.16)',
      }}
    >
      <Container maxWidth="sm" sx={{ height: 64, display: 'flex', alignItems: 'center' }}>
        <Box
          component="a"
          href="/"
          aria-label="Kaderblick Startseite"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'white', textDecoration: 'none' }}
        >
          <Box
            component="img"
            src="/images/kaderblick_website_appicon.svg"
            alt="Kaderblick Logo"
            sx={{ width: 36, height: 36, display: 'block' }}
          />
          <Typography
            component="span"
            sx={{
              fontFamily: "'ImpactWeb', Impact, 'Arial Black', sans-serif",
              fontSize: '1.45rem',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              transform: 'translateY(0.08em)',
            }}
          >
            <Box component="span" sx={{ color: '#34b74a' }}>K</Box>
            <Box component="span" sx={{ color: '#fff' }}>ADERBLICK</Box>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

function TickerPageFrame({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f4f6f4',
        backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(52,183,74,0.10), transparent 34rem)',
        pb: 6,
      }}
    >
      <TickerBrandHeader />
      {children}
    </Box>
  );
}

function UnavailableTicker({ connectionProblem }: { connectionProblem: boolean }) {
  return (
    <TickerPageFrame>
      <Container maxWidth="sm" sx={{ pt: { xs: 5, sm: 8 } }}>
        <Card
          sx={{
            textAlign: 'center',
            border: '1px solid rgba(16,39,26,0.10)',
            boxShadow: '0 18px 50px rgba(16,39,26,0.10)',
          }}
        >
          <CardContent sx={{ px: { xs: 3, sm: 6 }, py: { xs: 5, sm: 6 }, '&:last-child': { pb: { xs: 5, sm: 6 } } }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                mx: 'auto',
                mb: 2.5,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: '#287a45',
                bgcolor: 'rgba(52,183,74,0.11)',
              }}
            >
              {connectionProblem ? <WifiOffIcon sx={{ fontSize: 36 }} /> : <EventBusyIcon sx={{ fontSize: 38 }} />}
            </Box>
            <Chip
              label={connectionProblem ? 'Verbindung unterbrochen' : 'Liveticker nicht aktiv'}
              size="small"
              sx={{ mb: 2, fontWeight: 800, color: '#1e6337', bgcolor: 'rgba(52,183,74,0.10)' }}
            />
            <Typography component="h1" variant="h5" sx={{ fontWeight: 850, color: '#10271a', mb: 1.25 }}>
              {connectionProblem ? 'Der Liveticker ist gerade nicht erreichbar' : 'Die öffentliche Übertragung ist beendet'}
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.65, maxWidth: 430, mx: 'auto' }}>
              {connectionProblem
                ? 'Bitte versuche es in einigen Augenblicken erneut.'
                : 'Der Verein hat diesen Liveticker beendet oder momentan nicht öffentlich freigegeben.'}
            </Typography>
            <Button
              component="a"
              href="/"
              variant="contained"
              startIcon={<HomeOutlinedIcon />}
              sx={{ mt: 3.5, px: 2.5 }}
            >
              Zur Kaderblick-Startseite
            </Button>
          </CardContent>
        </Card>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5, textAlign: 'center' }}>
          Kaderblick verbindet Vereine, Mannschaften und Fans – auf und neben dem Platz.
        </Typography>
      </Container>
    </TickerPageFrame>
  );
}

export default function PublicLiveTicker() {
  const { token = '' } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicLiveTickerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorKind, setErrorKind] = useState<'unavailable' | 'connection' | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    if (silent) setRefreshing(true);
    try {
      const result = await fetchPublicLiveTicker(token);
      setData(result);
      setErrorKind(null);
    } catch (err) {
      setErrorKind(err instanceof ApiError && err.status === 404 ? 'unavailable' : 'connection');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => load(true), REFRESH_INTERVAL);
    return () => window.clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <TickerPageFrame>
        <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
          <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress />
            <Typography color="text.secondary">Liveticker wird geladen …</Typography>
          </Stack>
        </Box>
      </TickerPageFrame>
    );
  }

  if (!data) {
    return <UnavailableTicker connectionProblem={errorKind === 'connection'} />;
  }

  const { game } = data;
  return (
    <TickerPageFrame>
      <Container maxWidth="sm" sx={{ pt: 3 }}>
        {errorKind && <Alert severity="warning" sx={{ mb: 2 }}>Die Aktualisierung ist fehlgeschlagen. Der letzte Stand bleibt sichtbar.</Alert>}
        <Card sx={{ mb: 2, overflow: 'visible' }}>
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <Chip
              label={statusLabel(game.status)}
              color={game.status === 'live' ? 'error' : 'default'}
              size="small"
              sx={{ mb: 2, fontWeight: 800 }}
            />
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ flex: 1, textAlign: 'right', fontWeight: 700 }}>{game.homeTeam.name}</Typography>
              <Typography variant="h3" sx={{ fontWeight: 900, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {game.homeScore} : {game.awayScore}
              </Typography>
              <Typography sx={{ flex: 1, textAlign: 'left', fontWeight: 700 }}>{game.awayTeam.name}</Typography>
            </Stack>
            {game.startsAt && (
              <Typography variant="caption" color="text.secondary">
                {new Date(game.startsAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Spielticker</Typography>
          <Button size="small" onClick={() => load(true)} startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}>
            Aktualisieren
          </Button>
        </Stack>

        {data.events.length === 0 ? (
          <Card variant="outlined"><CardContent><Typography color="text.secondary">Noch keine Ereignisse erfasst.</Typography></CardContent></Card>
        ) : (
          <Stack spacing={1.25}>
            {data.events.map((event) => (
              <Card key={event.id} variant="outlined" sx={{ borderLeft: 5, borderLeftColor: event.type.color || (event.team.side === 'home' ? 'primary.main' : 'secondary.main') }}>
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <Box sx={{ color: event.type.color || 'text.secondary', pt: 0.25 }}><EventIcon event={event} /></Box>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 900 }}>{event.minute != null ? String(event.minute) + "'" : '–'}</Typography>
                        <Typography sx={{ fontWeight: 700 }}>{event.type.name}</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{event.team.name}</Typography>
                      {event.description && <Typography sx={{ mt: 0.75 }}>{event.description}</Typography>}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
          Zuletzt aktualisiert: {new Date(data.updatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </Typography>
        <Divider sx={{ my: 3 }} />
        <Stack spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>Push-Nachrichten und weitere Vereinsfunktionen gibt es mit einem kostenlosen Konto.</Typography>
          <Button startIcon={<LoginIcon />} onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { initialTab: 'register' } }))}>
            Kostenlos registrieren
          </Button>
        </Stack>
      </Container>
    </TickerPageFrame>
  );
}
