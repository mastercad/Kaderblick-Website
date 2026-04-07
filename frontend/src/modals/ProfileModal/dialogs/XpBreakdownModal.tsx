import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import BaseModal from '../../BaseModal';
import { apiJson } from '../../../utils/api';

interface XpEntry {
  actionType: string;
  label: string;
  xp: number;
}

export function XpBreakdownModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading,   setLoading]   = React.useState(false);
  const [breakdown, setBreakdown] = React.useState<XpEntry[]>([]);
  const [error,     setError]     = React.useState<string | null>(null);
  const [title,     setTitle]     = React.useState<any>(null);
  const [allTitles, setAllTitles] = React.useState<any[]>([]);
  const [level,     setLevel]     = React.useState<any>(null);
  const [xpTotal,   setXpTotal]   = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setBreakdown([]);
    setTitle(null);
    setAllTitles([]);
    setLevel(null);
    setXpTotal(null);
    apiJson('/api/xp-breakdown')
      .then((data: any) => {
        if (data && Array.isArray(data.breakdown)) {
          setBreakdown(data.breakdown);
          setTitle(data.title ?? null);
          setAllTitles(Array.isArray(data.allTitles) ? data.allTitles : []);
          setLevel(data.level ?? null);
          setXpTotal(typeof data.xpTotal === 'number' ? data.xpTotal : null);
        } else {
          setError(data?.error ?? 'Unbekannter Fehler beim Laden der XP-Daten');
        }
      })
      .catch(() => setError('Fehler beim Laden der XP-Daten'))
      .finally(() => setLoading(false));
  }, [open]);

  const maxXp = React.useMemo(() => Math.max(...breakdown.map(b => b.xp), 1), [breakdown]);

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="Erfahrungspunkte – Aufschlüsselung"
      maxWidth="sm"
      actions={<Button onClick={onClose} variant="contained">Schließen</Button>}
    >
      <Box sx={{ p: { xs: 1, sm: 2 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {title && (
                <Chip icon={<EmojiEventsIcon />} label={title.displayName} color="warning" variant="outlined" sx={{ fontWeight: 700 }} />
              )}
              {level && (
                <Chip
                  icon={<StarIcon />}
                  label={`Level ${level.level} · ${(xpTotal ?? level.xpTotal).toLocaleString()} XP`}
                  color="primary" variant="outlined" sx={{ fontWeight: 700 }}
                />
              )}
              {allTitles.filter(t => !title || t.id !== title.id).map(t => (
                <Chip key={t.id} label={t.displayName} size="small" variant="outlined" />
              ))}
            </Box>
            {breakdown.length === 0 ? (
              <Typography color="text.secondary" textAlign="center">Keine XP-Daten gefunden.</Typography>
            ) : (
              <Stack spacing={1.5}>
                {breakdown.map(item => (
                  <Box key={item.actionType}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography variant="body2">{item.label}</Typography>
                      <Typography variant="body2" fontWeight={700}>{item.xp.toLocaleString()} XP</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.round((item.xp / maxXp) * 100)}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </BaseModal>
  );
}
