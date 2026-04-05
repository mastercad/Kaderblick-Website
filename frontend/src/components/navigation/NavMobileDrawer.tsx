import React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Badge from '@mui/material/Badge';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import MessageIcon from '@mui/icons-material/Message';
import BarChartIcon from '@mui/icons-material/BarChart';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import PollIcon from '@mui/icons-material/Poll';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FeedbackIcon from '@mui/icons-material/Feedback';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import { useTheme, alpha } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useNavConfig, isNavItemActive, navItemColorMap } from './navigationConfig';

interface NavMobileDrawerProps {
  open: boolean;
  onClose: () => void;
  openMessages: () => void;
  onOpenQRShare: () => void;
}

const tileBaseSx = (active: boolean, primary: string) => ({
  display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
  justifyContent: 'center', p: 1.5, borderRadius: 2, width: '100%',
  bgcolor: active ? alpha(primary, 0.1) : 'grey.100',
  border: `1px solid ${active ? alpha(primary, 0.35) : '#e0e0e0'}`,
  transition: 'all 0.15s',
  '&:hover': { bgcolor: active ? alpha(primary, 0.15) : 'grey.200' },
  '&:active': { transform: 'scale(0.94)' },
});

export default function NavMobileDrawer({ open, onClose, openMessages, onOpenQRShare }: NavMobileDrawerProps) {
  const { adminMenuSections, isAdmin, isCoach } = useNavConfig();
  const { notifications } = useNotifications();
  const unreadMessageCount = notifications.filter(n => n.type === 'message' && !n.read).length;
  const theme = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const active = (key: string) => isNavItemActive(pathname, key);
  const go = (path: string) => { onClose(); navigate(path); };
  const primary = theme.palette.primary.main;

  const TileLabel = ({ label, isActive, activeColor }: { label: string; isActive: boolean; activeColor?: string }) => (
    <Typography variant="caption" fontWeight={isActive ? 700 : 400}
      textAlign="center" sx={{ lineHeight: 1.2, fontSize: '0.7rem', color: isActive && activeColor ? activeColor : (isActive ? 'primary.main' : 'text.primary') }}>
      {label}
    </Typography>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', my: 1.5 }}>
      <Divider sx={{ flex: 1 }} />
      <Typography variant="caption" fontWeight={700} color="text.secondary"
        sx={{ mx: 1.5, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
        {title}
      </Typography>
      <Divider sx={{ flex: 1 }} />
    </Box>
  );

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '80vh',
          overflowY: 'auto',
          pb: 2,
        },
      }}
    >
      {/* Drag handle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
      </Box>

      <Box sx={{ px: 2, pb: 3 }}>
        {/* Standard-Items */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 1 }}>
          {([
            { key: 'reports',       label: 'Auswertungen', icon: <BarChartIcon sx={{ fontSize: 28 }} />,   color: navItemColorMap['reports'] },
            { key: 'news',          label: 'Neuigkeiten',  icon: <NewspaperIcon sx={{ fontSize: 28 }} />,  color: navItemColorMap['news'] },
            { key: 'surveys',       label: 'Umfragen',     icon: <PollIcon sx={{ fontSize: 28 }} />,       color: navItemColorMap['surveys'] },
            { key: 'tasks',         label: 'Aufgaben',     icon: <AssignmentIcon sx={{ fontSize: 28 }} />, color: navItemColorMap['tasks'] },
            { key: 'mein-feedback', label: 'Mein Feedback',icon: <FeedbackIcon sx={{ fontSize: 28 }} />,   color: navItemColorMap['mein-feedback'] },
          ] as { key: string; label: string; icon: React.ReactElement; color: string }[]).map((tile) => {
            const isActive = active(tile.key);
            return (
              <ButtonBase key={tile.key} onClick={() => go(`/${tile.key}`)} sx={tileBaseSx(isActive, tile.color)}>
                <Box sx={{ color: tile.color, opacity: isActive ? 1 : 0.65, mb: 0.5, lineHeight: 0, transition: 'opacity 0.15s' }}>{tile.icon}</Box>
                <TileLabel label={tile.label} isActive={isActive} activeColor={tile.color} />
              </ButtonBase>
            );
          })}
          {/* Nachrichten */}
          <ButtonBase onClick={() => { onClose(); openMessages(); }} sx={tileBaseSx(false, navItemColorMap['messages'])}>
            <Box sx={{ color: navItemColorMap['messages'], opacity: 0.65, mb: 0.5, lineHeight: 0, transition: 'opacity 0.15s' }}>
              <Badge badgeContent={unreadMessageCount} color="error">
                <MessageIcon sx={{ fontSize: 28 }} />
              </Badge>
            </Box>
            <TileLabel label="Nachrichten" isActive={false} />
          </ButtonBase>
        </Box>

        {/* Trainer-Bereich */}
        {isCoach && (
          <>
            <SectionHeader title="Trainer" />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 1 }}>
              {([
                { key: 'formations',      label: 'Aufstellungen', icon: <GroupWorkIcon sx={{ fontSize: 28 }} />,  color: navItemColorMap['formations'] },
                { key: 'players',         label: 'Spieler',       icon: <PersonIcon sx={{ fontSize: 28 }} />,     color: navItemColorMap['players'] },
                { key: 'teams',           label: 'Teams',         icon: <GroupsIcon sx={{ fontSize: 28 }} />,     color: navItemColorMap['teams'] },
                { key: 'team-size-guide', label: 'Team Size',     icon: <CheckroomIcon sx={{ fontSize: 28 }} />,  color: navItemColorMap['team-size-guide'] },
              ] as { key: string; label: string; icon: React.ReactElement; color: string }[]).map((tile) => {
                const isActive = active(tile.key);
                return (
                  <ButtonBase key={tile.key} onClick={() => go(`/${tile.key}`)} sx={tileBaseSx(isActive, tile.color)}>
                    <Box sx={{ color: tile.color, opacity: isActive ? 1 : 0.65, mb: 0.5, lineHeight: 0, transition: 'opacity 0.15s' }}>{tile.icon}</Box>
                    <TileLabel label={tile.label} isActive={isActive} activeColor={tile.color} />
                  </ButtonBase>
                );
              })}
            </Box>
          </>
        )}

        {/* Administrations-Bereich */}
        {isAdmin && (
          <>
            <SectionHeader title="Administration" />
            {adminMenuSections.map((section) => (
              <Box key={section.section} sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.disabled"
                  sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.62rem', px: 0.5, display: 'block', mb: 0.75 }}>
                  {section.section}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                  {section.items.map((item) => {
                    const isActive = pathname === `/${item.page || item.href}`;
                    return (
                      <ButtonBase
                        key={item.label}
                        onClick={() => { onClose(); if (item.page) navigate(`/${item.page}`); else if (item.href) navigate(item.href!); }}
                        sx={tileBaseSx(isActive, primary)}
                      >
                        <Box sx={{ color: isActive ? 'primary.main' : 'text.secondary', mb: 0.5, lineHeight: 0 }}>
                          {React.cloneElement(item.icon as React.ReactElement<any>, { sx: { fontSize: 28, color: 'inherit' } })}
                        </Box>
                        <TileLabel label={item.label} isActive={isActive} />
                      </ButtonBase>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </>
        )}

        {/* QR-Code */}
        <Divider sx={{ my: 1.5 }} />
        <ListItem disablePadding>
          <ListItemButton onClick={() => { onClose(); onOpenQRShare(); }}>
            <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
              <QrCode2Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Registrierungs-QR-Code teilen" />
          </ListItemButton>
        </ListItem>
      </Box>
    </Drawer>
  );
}
