import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  IconButton,
  useTheme,
  alpha
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NewsIcon from '@mui/icons-material/Article';
import MessageIcon from '@mui/icons-material/Message';
import EventIcon from '@mui/icons-material/Event';
import SystemIcon from '@mui/icons-material/Info';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import FeedbackIcon from '@mui/icons-material/Feedback';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useNavigate } from 'react-router-dom';
import { AppNotification } from '../types/notifications';

interface NotificationDetailModalProps {
  notification: AppNotification | null;
  open: boolean;
  onClose: () => void;
}

const getNotificationIcon = (type: AppNotification['type']) => {
  switch (type) {
    case 'news': return <NewsIcon />;
    case 'message': return <MessageIcon />;
    case 'participation': return <EventIcon />;
    case 'system': return <SystemIcon />;
    case 'team_ride':
    case 'team_ride_booking':
    case 'team_ride_cancel':
    case 'team_ride_deleted':
      return <DirectionsCarIcon />;
    case 'event_cancelled':
      return <EventBusyIcon />;
    case 'feedback':
      return <FeedbackIcon />;
    case 'new_user_registration':
    case 'registration_request':
    case 'registration_request_approved':
      return <HowToRegIcon />;
    case 'supporter_request':
    case 'supporter_request_approved':
    case 'supporter_request_rejected':
      return <SupportAgentIcon />;
    default: return <SystemIcon />;
  }
};

const getNotificationColor = (type: AppNotification['type']) => {
  switch (type) {
    case 'news': return '#1976d2';
    case 'message': return '#2e7d32';
    case 'participation': return '#ed6c02';
    case 'system': return '#0288d1';
    case 'team_ride':
    case 'team_ride_booking':
      return '#7b1fa2';
    case 'team_ride_cancel':
    case 'team_ride_deleted':
      return '#d32f2f';
    case 'event_cancelled':
      return '#e65100';
    case 'feedback':
      return '#7b5ea7';
    case 'new_user_registration':
      return '#455a64';
    case 'registration_request':
    case 'registration_request_approved':
      return '#1565c0';
    case 'supporter_request':
      return '#00695c';
    case 'supporter_request_approved':
      return '#2e7d32';
    case 'supporter_request_rejected':
      return '#c62828';
    default: return '#757575';
  }
};

const getNotificationLabel = (type: AppNotification['type']) => {
  switch (type) {
    case 'news': return 'Neuigkeiten';
    case 'message': return 'Nachricht';
    case 'participation': return 'Teilnahme';
    case 'system': return 'System';
    case 'team_ride': return 'Mitfahrgelegenheit';
    case 'team_ride_booking': return 'Mitfahrt gebucht';
    case 'team_ride_cancel': return 'Mitfahrt storniert';
    case 'team_ride_deleted': return 'Mitfahrt gelöscht';
    case 'event_cancelled': return 'Event abgesagt';
    case 'feedback': return 'Feedback-Antwort';
    case 'new_user_registration': return 'Neue Registrierung';
    case 'registration_request': return 'Zuordnungsantrag';
    case 'registration_request_approved': return 'Zuordnungsantrag';
    case 'supporter_request': return 'Supporter-Anfrage';
    case 'supporter_request_approved': return 'Supporter-Anfrage';
    case 'supporter_request_rejected': return 'Supporter-Anfrage';
    default: return 'Benachrichtigung';
  }
};

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  notification,
  open,
  onClose
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  if (!notification) {
    return null;
  }

  const color = getNotificationColor(notification.type);
  const icon = getNotificationIcon(notification.type);
  const label = getNotificationLabel(notification.type);

  const handleNavigate = (url: string) => {
    onClose();
    navigate(url);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderTop: `4px solid ${color}`,
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color, display: 'flex', alignItems: 'center' }}>
            {icon}
          </Box>
          <Typography variant="h6" component="span">
            {notification.title}
          </Typography>
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip 
            label={label}
            size="small"
            sx={{ 
              backgroundColor: alpha(color, 0.1),
              color: color,
              fontWeight: 'medium'
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {notification.timestamp instanceof Date 
              ? notification.timestamp.toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Ungültiges Datum'
            }
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {notification.message}
          </Typography>
        </Box>

        {notification.data && Object.keys(notification.data).length > 0 && (
          <Box sx={{ 
            mt: 3,
            p: 2,
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            borderRadius: 1,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
          }}>
            {renderNotificationData(notification.type, notification.data, handleNavigate)}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained">
          Schließen
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Keys that should be hidden (internal IDs etc.)
const HIDDEN_KEYS = new Set(['eventId', 'id', 'rideId', 'userId', 'conversationId']);

// Keys that represent a title — shown as text without label
const TITLE_KEYS = new Set(['eventTitle', 'title', 'eventName', 'name']);

// Keys that represent a URL — rendered as clickable button
const URL_KEYS = new Set(['url', 'link']);

// Hilfsfunktion zum Rendern typenspezifischer Daten
const renderNotificationData = (type: AppNotification['type'], data: any, onNavigate: (url: string) => void) => {
  // Type-specific rendering for known types
  switch (type) {
    case 'news':
      return (
        <Box>
          {data.author && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Autor:</strong> {data.author}
            </Typography>
          )}
          {data.category && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Kategorie:</strong> {data.category}
            </Typography>
          )}
          {renderSmartUrl(data.url, onNavigate)}
        </Box>
      );

    case 'message':
      return (
        <Box>
          {data.sender && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Von:</strong> {data.sender}
            </Typography>
          )}
          {renderSmartUrl(data.url, onNavigate)}
        </Box>
      );

    case 'participation':
      return (
        <Box>
          {data.eventName && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Event:</strong> {data.eventName}
            </Typography>
          )}
          {data.eventDate && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Datum:</strong> {new Date(data.eventDate).toLocaleString('de-DE')}
            </Typography>
          )}
          {data.location && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Ort:</strong> {data.location}
            </Typography>
          )}
          {data.status && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Status:</strong> {data.status}
            </Typography>
          )}
          {renderSmartUrl(data.url, onNavigate)}
        </Box>
      );

    case 'system':
      return (
        <Box>
          {data.version && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Version:</strong> {data.version}
            </Typography>
          )}
          {data.priority && (
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Priorität:</strong> {data.priority}
            </Typography>
          )}
          {renderSmartUrl(data.url, onNavigate)}
        </Box>
      );

    case 'feedback':
      return (
        <Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<FeedbackIcon />}
            onClick={() => onNavigate(data.url ?? '/mein-feedback')}
            sx={{ mt: 0.5 }}
          >
            Feedback öffnen
          </Button>
        </Box>
      );

    default:
      return renderSmartData(data, onNavigate);
  }
};

// Smart rendering for URL fields
const renderSmartUrl = (url: string | undefined, onNavigate: (url: string) => void) => {
  if (!url) return null;
  return (
    <Box sx={{ mt: 1 }}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<OpenInNewIcon />}
        onClick={() => onNavigate(url)}
      >
        Öffnen
      </Button>
    </Box>
  );
};

// Generic smart rendering for any data object
const renderSmartData = (data: any, onNavigate: (url: string) => void) => {
  const entries = Object.entries(data);
  const titleEntry = entries.find(([key]) => TITLE_KEYS.has(key));
  const urlEntry = entries.find(([key]) => URL_KEYS.has(key));
  const otherEntries = entries.filter(
    ([key]) => !HIDDEN_KEYS.has(key) && !TITLE_KEYS.has(key) && !URL_KEYS.has(key)
  );

  return (
    <Box>
      {titleEntry && (
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
          {String(titleEntry[1])}
        </Typography>
      )}
      {otherEntries.map(([key, value]) => (
        <Typography key={key} variant="body2" sx={{ mb: 0.5 }}>
          <strong>{key}:</strong> {String(value)}
        </Typography>
      ))}
      {renderSmartUrl(urlEntry ? String(urlEntry[1]) : undefined, onNavigate)}
    </Box>
  );
};
