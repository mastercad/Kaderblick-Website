import React, { useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import { useSearchParams } from 'react-router-dom';
import { apiJson } from '../utils/api';
import { useWidgetRefresh } from '../context/WidgetRefreshContext';

type Message = {
  id: number;
  subject: string;
  sentAt: string;
  sender: {
    id: number;
    fullName: string;
  } | null;
};

export const MessagesWidget: React.FC<{ config?: any; widgetId?: string }> = ({ config, widgetId }) => {
  const { getRefreshTrigger } = useWidgetRefresh();
  const [, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTrigger = widgetId ? getRefreshTrigger(widgetId) : 0;

  useEffect(() => {
    if (!widgetId) {
      setError('Widget-ID fehlt');
      setLoading(false);
      return;
    }
    setLoading(true);
    apiJson(`/widget/${widgetId}/content`)
      .then((data) => {
        setMessages(data.messages || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [widgetId, refreshTrigger]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!messages.length) return (
    <Typography variant="body2" sx={{
      color: "text.secondary"
    }}>Keine Nachrichten vorhanden.</Typography>
  );

  const handleClick = (id: number) => {
    setSearchParams({ modal: 'messages', messageId: String(id) });
  };

  return (
    <List dense>
      {messages.map((msg) => (
        <ListItem key={msg.id} alignItems="flex-start" disableGutters disablePadding>
          <ListItemButton onClick={() => handleClick(msg.id)} sx={{ borderRadius: 1 }}>
            <ListItemText
              primary={msg.subject}
              secondary={
                <>
                  <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>
                    {msg.sender?.fullName || 'Unbekannt'} &ndash; {new Date(msg.sentAt).toLocaleString()}
                  </Typography>
                </>
              }
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
};
