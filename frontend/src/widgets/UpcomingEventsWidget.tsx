import React, { useCallback, useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import { EventDetailsModal } from '../modals/EventDetailsModal';
import { useCalendarEventDetailsLoader } from '../hooks/useCalendarEventDetails';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import Box from '@mui/material/Box';
import Location from '../components/Location';
import CircularProgress from '@mui/material/CircularProgress';
import { apiJson } from '../utils/api';
import { useWidgetRefresh } from '../context/WidgetRefreshContext';

interface EventType {
  id: number;
  title: string;
  startDate: string;
  endDate?: string;
  location?: {
    id: number;
    name: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  } | string | null;
  calendarEventType?: {
    name?: string;
    color?: string;
  };
}

export const UpcomingEventsWidget: React.FC<{ widgetId: string; config?: any }> = ({ widgetId }) => {
  const { getRefreshTrigger } = useWidgetRefresh();
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    selectedEvent,
    loadingEventId,
    openEventDetails,
    closeEventDetails,
  } = useCalendarEventDetailsLoader((message) => setError(message));

  const refreshTrigger = getRefreshTrigger(widgetId);

  const loadWidgetContent = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    if (!widgetId) {
      setError('Widget-ID fehlt');
      setLoading(false);
      return;
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const data = await apiJson(`/widget/${widgetId}/content`);
      setEvents(data.events || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [widgetId]);

  useEffect(() => {
    loadWidgetContent();
  }, [loadWidgetContent, refreshTrigger]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>;
  }
  if (error) {
    return <Typography color="error">{error}</Typography>;
  }
  if (!events.length) {
    return <Typography variant="body2" color="text.secondary" align="center">Keine anstehenden Termine</Typography>;
  }

  return (
    <>
    {refreshing && <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}><CircularProgress size={16} /></Box>}
    <List dense disablePadding>
      {events.map(event => (
        <ListItem
          key={event.id}
          alignItems="flex-start"
          onClick={() => void openEventDetails(event.id)}
          sx={{ borderLeft: `4px solid ${event.calendarEventType?.color || '#1976d2'}`, mb: 1, pl: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: event.calendarEventType?.color || 'primary.main' }}>
            <CalendarTodayIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={<>
              <Typography variant="subtitle2" component="span">{event.title}</Typography>
              {loadingEventId === event.id && <CircularProgress size={14} sx={{ ml: 1, verticalAlign: 'middle' }} />}
              {event.calendarEventType?.name && (
                <Box component="span" sx={{ ml: 1, fontSize: 12, color: event.calendarEventType.color || 'primary.main', fontWeight: 500 }}>
                  {event.calendarEventType.name}
                </Box>
              )}
            </>}
            secondary={<>
              <Typography variant="caption" color="text.secondary" component="span">
                {new Date(event.startDate).toLocaleDateString()} {event.endDate ? `${new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(event.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
              {event.location && (() => {
                const loc = typeof event.location === 'string'
                  ? { id: 0, name: event.location }
                  : event.location!;
                return (
                  <Box component="span" sx={{ ml: 2, display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>
                    <Location
                      id={loc.id}
                      name={loc.name}
                      latitude={loc.latitude}
                      longitude={loc.longitude}
                      address={loc.address}
                    />
                  </Box>
                );
              })()}
            </>}
          />
        </ListItem>
      ))}
    </List>
    <EventDetailsModal
      open={!!selectedEvent}
      onClose={closeEventDetails}
      event={selectedEvent}
      onUpdated={() => loadWidgetContent({ silent: true })}
      onCancelled={() => {
        closeEventDetails();
        loadWidgetContent({ silent: true });
      }}
    />
    </>
  );
};
