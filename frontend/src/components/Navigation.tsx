import React, { Suspense, lazy, useState } from 'react';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../utils/api';
import { isPublicSeoPath } from '../seo/siteConfig';
import { useViewportPinnedBottomNav, MOBILE_BOTTOM_NAV_HEIGHT } from './navigation/useViewportPinnedBottomNav';
import NavAppBar from './navigation/NavAppBar';
import NavMobileDrawer from './navigation/NavMobileDrawer';
import NavMobileBottomBar from './navigation/NavMobileBottomBar';
import NavNotificationCenter from './navigation/NavNotificationCenter';
import NavUserMenu from './navigation/NavUserMenu';

const RegistrationContextDialog = lazy(() => import('../modals/RegistrationContextDialog'));


interface NavigationProps {
  onOpenAuth: () => void;
  onOpenDemo: () => void;
  onOpenProfile: () => void;
  onOpenQRShare: () => void;
  openMessages: () => void;
}

export default function Navigation({ onOpenAuth, onOpenDemo, onOpenProfile, onOpenQRShare, openMessages }: NavigationProps) {
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const viewportPinnedBottomNav = useViewportPinnedBottomNav(isMobile && isAuthenticated, MOBILE_BOTTOM_NAV_HEIGHT);
  const location = useLocation();
  const isPublicSeoRoute = isPublicSeoPath(location.pathname);
  const shouldShowGlobalTopNav = isAuthenticated || !isPublicSeoRoute;
  const shouldShowMobileAppNav = isMobile && isAuthenticated;

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
      {shouldShowGlobalTopNav && <Box sx={{ height: 'var(--app-header-height)', transition: 'height 0.25s ease' }} />}

      {shouldShowGlobalTopNav && (
        <NavAppBar
          onOpenAuth={onOpenAuth}
          onOpenDemo={onOpenDemo}
          onOpenNotifications={(e) => setNotifAnchorEl(e.currentTarget)}
          onOpenUserMenu={(e) => setUserMenuAnchorEl(e.currentTarget)}
        />
      )}

      {shouldShowMobileAppNav && (
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

      <Suspense fallback={null}>
        {showRelationModal && (
          <RegistrationContextDialog open onClose={() => setShowRelationModal(false)} />
        )}
      </Suspense>
    </>
  );
}
