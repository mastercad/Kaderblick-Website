import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import CakeIcon from '@mui/icons-material/Cake';
import { apiJson } from '../utils/api';
import { useWidgetRefresh } from '../context/WidgetRefreshContext';

interface BirthdayEntry {
  id: number;
  name: string;
  birthdate: string;
  age: number;
  daysAgo: number;
  teams: string[];
}

function formatDaysAgo(daysAgo: number): string {
  if (daysAgo === 0) return 'Heute';
  if (daysAgo === 1) return 'Gestern';
  return `Vor ${daysAgo} Tagen`;
}

export const BirthdaysWidget: React.FC<{ widgetId: string }> = ({ widgetId }) => {
  const { getRefreshTrigger } = useWidgetRefresh();
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTrigger = getRefreshTrigger(widgetId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ birthdays: BirthdayEntry[] }>(`/widget/${widgetId}/content`);
      setBirthdays(data.birthdays ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [widgetId]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>;
  }

  if (error) {
    return <Typography color="error" variant="body2">{error}</Typography>;
  }

  if (!birthdays.length) {
    return (
      <Typography variant="body2" align="center" sx={{ color: 'text.secondary' }}>
        Keine Geburtstage in den letzten 7 Tagen
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {birthdays.map(b => (
        <ListItem
          key={b.id}
          alignItems="flex-start"
          sx={{
            mb: 0.5,
            borderLeft: `4px solid ${b.daysAgo === 0 ? '#e91e63' : '#9e9e9e'}`,
            pl: 1,
            gap: 1,
          }}
        >
          <Box sx={{ color: b.daysAgo === 0 ? 'error.main' : 'text.secondary', mt: 0.5, flexShrink: 0 }}>
            <CakeIcon fontSize="small" />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" component="span">
                {b.name}
              </Typography>
              <Typography variant="caption" component="span" sx={{ color: 'text.secondary' }}>
                ({b.age} Jahre)
              </Typography>
              {b.daysAgo === 0 && (
                <Chip label="Heute" size="small" color="error" sx={{ height: 18, fontSize: 11 }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.25 }}>
              <Typography variant="caption" component="span" sx={{ color: 'text.secondary' }}>
                {formatDaysAgo(b.daysAgo)}
              </Typography>
              {b.teams.map(t => (
                <Chip key={t} label={t} size="small" variant="outlined" sx={{ height: 16, fontSize: 10 }} />
              ))}
            </Box>
          </Box>
        </ListItem>
      ))}
    </List>
  );
};
