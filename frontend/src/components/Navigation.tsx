import React, { useState } from 'react';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../utils/api';
import RegistrationContextDialog from '../modals/RegistrationContextDialog';
import { useViewportPinnedBottomNav, MOBILE_BOTTOM_NAV_HEIGHT } from './navigation/useViewportPinnedBottomNav';
import NavAppBar from './navigation/NavAppBar';
import NavMobileDrawer from './navigation/NavMobileDrawer';
import NavMobileBottomBar from './navigation/NavMobileBottomBar';
import NavNotificationCenter from './navigation/NavNotificationCenter';
import NavUserMenu from './navigation/NavUserMenu';


interface NavigationProps {
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenQRShare: () => void;
  openMessages: () => void;
}

export default function Navigation({ onOpenAuth, onOpenProfile, onOpenQRShare, openMessages }: NavigationProps) {
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const viewportPinnedBottomNav = useViewportPinnedBottomNav(isMobile && isAuthenticated, MOBILE_BOTTOM_NAV_HEIGHT);
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';

  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl]       = useState<null | HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen]     = useState(false);
  const [userRelations, setUserRelations]       = useState<{ id: number }[]>([]);
  const [showRelationModal, setShowRelationModal] = useState(false);

  React.useEffect(() => {
    if (!isAuthenticated) { setUserRelations([]); return; }
    apiJson('/api/users/relations')
      .then(data => setUserRelations(Array.isArray(data) ? data : []))
      .catch(() => setUserRelations([]));
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
  }, [mobileMenuOpen]);

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
    document.body.classList.remove('menu-open');
  };

  return (
    <>
      {!isHome && <Box sx={{ height: { xs: 56, md: 64 } }} />}

      <NavAppBar
        onOpenAuth={onOpenAuth}
        onOpenNotifications={(e) => setNotifAnchorEl(e.currentTarget)}
        onOpenUserMenu={(e) => setUserMenuAnchorEl(e.currentTarget)}
      />

      {isMobile && isAuthenticated && (
        <>
          <NavMobileDrawer
            open={mobileMenuOpen}
            onClose={handleMobileMenuClose}
            onOpenQRShare={onOpenQRShare}
          />
          <NavMobileBottomBar
            mobileMenuOpen={mobileMenuOpen}
            onMobileMenuToggle={() => setMobileMenuOpen(prev => !prev)}
            onMobileMenuClose={handleMobileMenuClose}
            viewportPinnedNav={viewportPinnedBottomNav}
          />
        </>
      )}

      <NavNotificationCenter
        anchorEl={notifAnchorEl}
        onClose={() => setNotifAnchorEl(null)}
      />

      <NavUserMenu
        anchorEl={userMenuAnchorEl}
        onClose={() => setUserMenuAnchorEl(null)}
        onOpenProfile={onOpenProfile}
        onOpenQRShare={onOpenQRShare}
        openMessages={openMessages}
        userRelations={userRelations}
        onRequestLink={() => setShowRelationModal(true)}
      />

      <RegistrationContextDialog
        open={showRelationModal}
        onClose={() => setShowRelationModal(false)}
      />
    </>
  );
}
