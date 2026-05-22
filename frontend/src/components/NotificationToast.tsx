import React, { useState } from 'react';
import { 
  Snackbar, 
  Alert, 
  Slide, 
  Box, 
  Typography, 
  IconButton,
  Chip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NewsIcon from '@mui/icons-material/Article';
import MessageIcon from '@mui/icons-material/Message';
import EventIcon from '@mui/icons-material/Event';
import SystemIcon from '@mui/icons-material/Info';
import { useNotifications } from '../context/NotificationContext';
import { AppNotification } from '../types/notifications';

const getNotificationIcon = (type: AppNotification['type']) => {
  switch (type) {
    case 'news': return <NewsIcon fontSize="small" />;
    case 'message': return <MessageIcon fontSize="small" />;
    case 'participation': return <EventIcon fontSize="small" />;
    case 'system': return <SystemIcon fontSize="small" />;
    default: return <SystemIcon fontSize="small" />;
  }
};

const getNotificationColor = (type: AppNotification['type']) => {
  switch (type) {
    case 'news': return 'info';
    case 'message': return 'warning';
    case 'participation': return 'success';
    case 'system': return 'info';
    default: return 'info';
  }
};

export const NotificationToast: React.FC = () => {
  const { notifications, markAsRead, removeNotification } = useNotifications();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [currentIndex, setCurrentIndex] = useState(0);

  // Zeige nur ungelesene Notifications
  const unreadNotifications = notifications.filter(n => !n.read);
  
  if (unreadNotifications.length === 0) return null;

  const currentNotification = unreadNotifications[currentIndex];
  if (!currentNotification) return null;

  const handleClose = () => {
    markAsRead(currentNotification.id);
    
    // Zeige nächste Notification falls vorhanden
    if (currentIndex < unreadNotifications.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleDismiss = () => {
    removeNotification(currentNotification.id);
    setCurrentIndex(0);
  };

  return (
    <Snackbar
      open={true}
      anchorOrigin={{ 
        vertical: isMobile ? 'top' : 'bottom', 
        horizontal: isMobile ? 'center' : 'right' 
      }}
      sx={{
        top: isMobile ? '16px !important' : undefined,
        '& .MuiSnackbarContent-root': {
          padding: 0,
        }
      }}
      slots={{
        transition: Slide
      }}
      slotProps={{
        transition: {
          direction: isMobile ? 'down' : 'left'
        } as any
      }}
    >
      <Alert 
        severity={getNotificationColor(currentNotification.type) as any}
        icon={getNotificationIcon(currentNotification.type)}
        variant="filled"
        sx={{
          width: isMobile ? '90vw' : '400px',
          maxWidth: isMobile ? '90vw' : '400px',
          '& .MuiAlert-message': {
            width: '100%',
            overflow: 'hidden'
          }
        }}
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {unreadNotifications.length > 1 && (
              <Chip 
                label={`${currentIndex + 1}/${unreadNotifications.length}`}
                size="small"
                variant="outlined"
                sx={{ 
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.5)',
                  fontSize: '0.7rem'
                }}
              />
            )}
            <IconButton
              size="small"
              onClick={handleClose}
              sx={{ color: 'inherit' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        onClick={handleClose}
        onClose={handleDismiss}
      >
        <Box>
          <Typography variant="subtitle2" component="div" sx={{ fontWeight: 'bold' }}>
            {currentNotification.title}
          </Typography>
          <Typography variant="body2" component="div" sx={{ 
            mt: 0.5,
            wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: isMobile ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {currentNotification.message}
          </Typography>
          <Typography variant="caption" sx={{ 
            opacity: 0.8, 
            mt: 0.5, 
            display: 'block' 
          }}>
            {currentNotification.timestamp.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Typography>
        </Box>
      </Alert>
    </Snackbar>
  );
};
