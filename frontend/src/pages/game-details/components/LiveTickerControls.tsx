import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  FormControlLabel, Stack, Switch, Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PublicIcon from '@mui/icons-material/Public';
import { Game } from '../../../types/games';
import { updatePublicLiveTicker } from '../../../services/games';
import { getApiErrorMessage } from '../../../utils/api';

interface LiveTickerControlsProps {
  game: Game;
  onChanged: (state: { enabled: boolean; token: string | null }) => void;
}

export default function LiveTickerControls({ game, onChanged }: LiveTickerControlsProps) {
  const [enabled, setEnabled] = useState(Boolean(game.publicLiveTickerEnabled));
  const [token, setToken] = useState(game.publicLiveTickerToken ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(game.publicLiveTickerEnabled));
    setToken(game.publicLiveTickerToken ?? null);
  }, [game.publicLiveTickerEnabled, game.publicLiveTickerToken]);

  const publicPath = token ? '/live/' + token : null;
  const publicUrl = publicPath ? window.location.origin + publicPath : null;

  const handleToggle = async (_event: unknown, checked: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const result = await updatePublicLiveTicker(game.id, checked);
      setEnabled(result.enabled);
      setToken(result.token);
      onChanged({ enabled: result.enabled, token: result.token });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Der Liveticker konnte nicht aktualisiert werden.'));
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card variant="outlined" sx={{ mb: 2, borderColor: enabled ? 'success.main' : 'divider' }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <PublicIcon color={enabled ? 'success' : 'disabled'} sx={{ mt: 0.5 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FormControlLabel
              control={<Switch checked={enabled} disabled={saving} onChange={handleToggle} />}
              label={<Typography sx={{ fontWeight: 700 }}>Öffentlicher Liveticker</Typography>}
              sx={{ m: 0 }}
            />
            <Typography variant="body2" color="text.secondary">
              Besucher sehen Spielstand und Ereignisse ohne Anmeldung. Spieler-, Trainer-, Video- und Aufstellungsdaten werden nicht veröffentlicht.
            </Typography>
            {enabled && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.75 }}>
                Freitext-Kommentare sind öffentlich. Bitte dort keine personenbezogenen Daten eintragen.
              </Typography>
            )}
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            {enabled && publicUrl && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                <Button component="a" href={publicPath!} target="_blank" rel="noopener" startIcon={<OpenInNewIcon />}>
                  Ticker öffnen
                </Button>
                <Button onClick={copyLink} startIcon={<ContentCopyIcon />}>
                  {copied ? 'Link kopiert' : 'Link kopieren'}
                </Button>
              </Stack>
            )}
          </Box>
          {saving && <CircularProgress size={22} />}
        </Stack>
      </CardContent>
    </Card>
  );
}
