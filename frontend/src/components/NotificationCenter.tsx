import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Button,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import NewsIcon from '@mui/icons-material/Article';
import MessageIcon from '@mui/icons-material/Message';
import EventIcon from '@mui/icons-material/Event';
import SystemIcon from '@mui/icons-material/Info';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import FeedbackIcon from '@mui/icons-material/Feedback';
import DeleteIcon from '@mui/icons-material/Delete';
import MarkAsReadIcon from '@mui/icons-material/DoneAll';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useNotifications } from '../context/NotificationContext';
import { AppNotification } from '../types/notifications';
import { NotificationDetailModal } from './NotificationDetailModal';

const getNotificationIcon = (type: AppNotification['type']) => {
  switch (type) {
    case 'news': return <NewsIcon fontSize="small" />;
    case 'message': return <MessageIcon fontSize="small" />;
    case 'participation': return <EventIcon fontSize="small" />;
    case 'system': return <SystemIcon fontSize="small" />;
    case 'team_ride':
    case 'team_ride_booking':
    case 'team_ride_cancel':
    case 'team_ride_deleted':
      return <DirectionsCarIcon fontSize="small" />;
    case 'event_cancelled':
      return <EventBusyIcon fontSize="small" />;
    case 'feedback':
      return <FeedbackIcon fontSize="small" />;
    default: return <SystemIcon fontSize="small" />;
  }
};

export const NotificationCenter: React.FC = () => {
  const theme = useTheme();
  const { 
    notifications, 
    markAsRead, 
    markAllAsRead, 
    clearAll, 
    unreadCount,
    selectedNotification,
    openNotificationDetail,
    closeNotificationDetail 
  } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: AppNotification) => {
    openNotificationDetail(notification);
    handleClose(); // Schließe das Popover
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{ 
          mr: 1,
          color: isHome
            ? '#fff'
            : 'primary.contrastText',
          '&:hover': {
            backgroundColor: alpha(theme.palette.common.white, 0.1)
          }
        }}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
        </Badge>
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              width: 400,
              maxHeight: 500,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }
          }
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center' 
          }}>
            <Typography variant="h6">
              Benachrichtigungen {unreadCount > 0 && `(${unreadCount})`}
            </Typography>
            <Box>
              {unreadCount > 0 && (
                <IconButton size="small" onClick={markAllAsRead} title="Alle als gelesen markieren">
                  <MarkAsReadIcon fontSize="small" />
                </IconButton>
              )}
              {notifications.length > 0 && (
                <IconButton size="small" onClick={clearAll} title="Alle löschen">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.primary', mb: 1 }} />
              <Typography variant="body2" sx={{
                color: "text.primary"
              }}>
                Keine Benachrichtigungen
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    component="div"
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      backgroundColor: notification.read ? 'transparent' : alpha(theme.palette.primary.main, 0.05),
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.1)
                      },
                      py: 1.5,
                      cursor: 'pointer'
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={notification.title}
                      secondary={
                        <Box component="span">
                          <Box 
                            component="span"
                            sx={{
                              display: '-webkit-box',
                              color: 'text.primary',
                              fontSize: '0.875rem',
                              lineHeight: 1.43,
                              letterSpacing: '0.01071em',
                              mb: 0.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}
                          >
                            {notification.message}
                          </Box>
                          <Box 
                            component="span"
                            sx={{
                              display: 'block',
                              color: 'text.primary',
                              fontSize: '0.75rem',
                              lineHeight: 1.66,
                              letterSpacing: '0.03333em'
                            }}
                          >
                            {notification.timestamp instanceof Date 
                              ? notification.timestamp.toLocaleString('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Ungültiges Datum'
                            }
                          </Box>
                        </Box>
                      }
                      slotProps={{
                        primary: {
                          sx: { 
                            fontWeight: notification.read ? 'normal' : 'bold',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }
                        }
                      }}
                    />
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Popover>
      <NotificationDetailModal
        notification={selectedNotification}
        open={Boolean(selectedNotification)}
        onClose={closeNotificationDetail}
      />
    </>
  );
};
