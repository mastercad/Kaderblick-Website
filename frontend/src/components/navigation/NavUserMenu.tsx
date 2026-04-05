import React from 'react';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import MessageIcon from '@mui/icons-material/Message';
import LinkIcon from '@mui/icons-material/Link';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

interface NavUserMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenQRShare: () => void;
  openMessages: () => void;
  userRelations: { id: number }[];
  onRequestLink: () => void;
}

export default function NavUserMenu({
  anchorEl, onClose, onOpenProfile, onOpenQRShare, openMessages, userRelations, onRequestLink,
}: NavUserMenuProps) {
  const { user, logout } = useAuth();
  const { notifications } = useNotifications();
  const unreadMessageCount = notifications.filter(n => n.type === 'message' && !n.read).length;

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <Menu
      id="menu-appbar"
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <MenuItem disabled sx={{ opacity: '1 !important' }}>
        <Box>
          <Typography variant="subtitle2">{user?.name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{user?.email}</Typography>
        </Box>
      </MenuItem>
      <Divider />

      <MenuItem onClick={() => { onClose(); onOpenProfile(); }}>
        <AccountCircleIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} />
        Profil
      </MenuItem>
      {userRelations.length === 0 && (
        <MenuItem onClick={() => { onClose(); onRequestLink(); }}>
          <LinkIcon fontSize="small" sx={{ color: 'warning.main', mr: 1 }} />
          Verknüpfung anfragen
        </MenuItem>
      )}
      <MenuItem onClick={() => { onClose(); onOpenQRShare(); }}>
        <QrCode2Icon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} />
        Registrierungs-QR-Code
      </MenuItem>
      <MenuItem onClick={() => { onClose(); openMessages(); }}>
        <Badge badgeContent={unreadMessageCount} color="error" sx={{ mr: 1 }}>
          <MessageIcon fontSize="small" sx={{ color: 'text.primary' }} />
        </Badge>
        Nachrichten
      </MenuItem>
      <MenuItem onClick={handleLogout}>
        <LogoutIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} />
        Logout
      </MenuItem>
    </Menu>
  );
}
