import React from 'react';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import NewsIcon from '@mui/icons-material/Article';
import MessageIcon from '@mui/icons-material/Message';
import EventIcon from '@mui/icons-material/Event';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import FeedbackIcon from '@mui/icons-material/Feedback';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme, alpha } from '@mui/material/styles';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationDetailModal } from '../NotificationDetailModal';
import { AppNotification } from '../../types/notifications';

interface NavNotificationCenterProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

function getNotificationIcon(type: AppNotification['type']) {
  switch (type) {
    case 'news':              return <NewsIcon fontSize="small" />;
    case 'message':           return <MessageIcon fontSize="small" />;
    case 'participation':     return <EventIcon fontSize="small" />;
    case 'team_ride':
    case 'team_ride_booking':
    case 'team_ride_cancel':
    case 'team_ride_deleted': return <DirectionsCarIcon fontSize="small" />;
    case 'event_cancelled':   return <EventBusyIcon fontSize="small" />;
    case 'feedback':          return <FeedbackIcon fontSize="small" />;
    default:                  return <NotificationsNoneIcon fontSize="small" />;
  }
}

function formatNotifTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `Vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Vor ${hours} Std.`;
  if (hours < 48) return 'Gestern';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const isToday =     (d: Date) => new Date().toDateString() === d.toDateString();
const isYesterday  = (d: Date) => { const y = new Date(); y.setDate(y.getDate() - 1); return y.toDateString() === d.toDateString(); };

export default function NavNotificationCenter({ anchorEl, onClose }: NavNotificationCenterProps) {
  const { notifications, unreadCount, markAllAsRead, clearAll, selectedNotification, openNotificationDetail, closeNotificationDetail } = useNotifications();
  const theme = useTheme();

  const renderItem = (n: AppNotification) => (
    <Box
      key={n.id}
      onClick={() => { onClose(); openNotificationDetail(n); }}
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2, py: 1.25,
        cursor: 'pointer',
        borderLeft: `3px solid ${n.read ? 'transparent' : theme.palette.primary.main}`,
        backgroundColor: n.read ? 'transparent' : alpha(theme.palette.primary.main, 0.04),
        transition: 'background-color 0.15s',
        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
      }}
    >
      <Box sx={{ mt: 0.25, color: n.read ? 'text.disabled' : 'primary.main', flexShrink: 0 }}>
        {getNotificationIcon(n.type)}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={n.read ? 400 : 600} noWrap sx={{ color: n.read ? 'text.secondary' : 'text.primary' }}>
          {n.title}
        </Typography>
        {n.message && (
          <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4, mt: 0.2 }}>
            {n.message}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.4 }}>
          {formatNotifTime(new Date(n.timestamp))}
        </Typography>
      </Box>
      {!n.read && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0, mt: 0.5 }} />}
    </Box>
  );

  const SectionLabel = ({ label }: { label: string }) => (
    <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
      <Typography variant="caption" fontWeight={700} color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.68rem' }}>
        {label}
      </Typography>
    </Box>
  );

  const todayItems     = notifications.filter(n =>  isToday(new Date(n.timestamp)));
  const yesterdayItems = notifications.filter(n =>  isYesterday(new Date(n.timestamp)));
  const olderItems     = notifications.filter(n => !isToday(new Date(n.timestamp)) && !isYesterday(new Date(n.timestamp)));

  return (
    <>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ elevation: 8, sx: { width: 400, maxHeight: 540, display: 'flex', flexDirection: 'column', overflow: 'hidden', mt: 1, borderRadius: 2 } }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.palette.divider}`, flexShrink: 0, background: theme.palette.background.paper }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={700}>Benachrichtigungen</Typography>
            {unreadCount > 0 && (
              <Box sx={{ bgcolor: 'error.main', color: '#fff', fontSize: '0.7rem', fontWeight: 700, borderRadius: '10px', px: 0.75, py: 0.1, lineHeight: 1.6 }}>
                {unreadCount}
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {unreadCount > 0 && (
              <Tooltip title="Alle als gelesen markieren">
                <IconButton size="small" onClick={() => markAllAsRead()}><DoneAllIcon sx={{ fontSize: 18 }} /></IconButton>
              </Tooltip>
            )}
            {notifications.length > 0 && (
              <Tooltip title="Alle löschen">
                <IconButton size="small" onClick={() => clearAll()}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Body */}
        {notifications.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <NotificationsNoneIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>Keine Benachrichtigungen</Typography>
            <Typography variant="caption" color="text.disabled">Du bist auf dem neuesten Stand!</Typography>
          </Box>
        ) : (
          <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
            {todayItems.length > 0 && <><SectionLabel label="Heute" />{todayItems.map(renderItem)}</>}
            {yesterdayItems.length > 0 && <><SectionLabel label="Gestern" />{yesterdayItems.map(renderItem)}</>}
            {olderItems.length > 0 && <><SectionLabel label="Früher" />{olderItems.map(renderItem)}</>}
          </Box>
        )}
      </Popover>

      <NotificationDetailModal
        notification={selectedNotification}
        open={Boolean(selectedNotification)}
        onClose={closeNotificationDetail}
      />
    </>
  );
}
