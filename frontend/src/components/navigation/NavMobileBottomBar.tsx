import React, { useState, useEffect } from 'react';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import GroupsIcon from '@mui/icons-material/Groups';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHomeScroll } from '../../context/HomeScrollContext';
import {
  MOBILE_BOTTOM_NAV_HEIGHT,
  MOBILE_BOTTOM_NAV_SAFE_AREA,
  ViewportPinnedNavStyle,
} from './useViewportPinnedBottomNav';
import { isNavItemActive } from './navigationConfig';

interface NavMobileBottomBarProps {
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
  onMobileMenuClose: () => void;
  viewportPinnedNav: ViewportPinnedNavStyle | null;
}

export default function NavMobileBottomBar({
  mobileMenuOpen,
  onMobileMenuToggle,
  onMobileMenuClose,
  viewportPinnedNav,
}: NavMobileBottomBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isOnHeroSection } = useHomeScroll();
  const isHome = pathname === '/' || pathname === '';

  const active = (key: string) => isNavItemActive(pathname, key);
  const go = (path: string) => { onMobileMenuClose(); navigate(path); };

  // Untere Navigation verstecken wenn die Taktiktafel offen ist
  const [tacticsBoardOpen, setTacticsBoardOpen] = useState(
    () => document.body.classList.contains('tactics-board-open'),
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTacticsBoardOpen(document.body.classList.contains('tactics-board-open'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => { observer.disconnect(); };
  }, []);

  if (tacticsBoardOpen) return null;

  const activeValue =
    active('dashboard')    ? 'dashboard' :
    active('spielbetrieb') ? 'games'     :
    active('team')         ? 'my-team'   :
    active('calendar')     ? 'calendar'  :
    mobileMenuOpen         ? 'more'      : false;

  return (
    <Paper
      elevation={isHome ? 0 : 4}
      sx={{
        position: 'fixed',
        zIndex: 1100,
        left:   viewportPinnedNav ? `${viewportPinnedNav.left}px`  : 0,
        right:  viewportPinnedNav ? 'auto' : 0,
        top:    viewportPinnedNav ? `${viewportPinnedNav.top}px`   : 'auto',
        bottom: viewportPinnedNav ? 'auto' : 0,
        width:  viewportPinnedNav ? `${viewportPinnedNav.width}px` : 'auto',
        minHeight: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + ${MOBILE_BOTTOM_NAV_SAFE_AREA})`,
        pb: MOBILE_BOTTOM_NAV_SAFE_AREA,
        boxSizing: 'border-box',
        overflow: 'hidden',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        willChange: viewportPinnedNav ? 'top, left, width' : 'auto',
        ...(isHome && isOnHeroSection && {
          background: 'transparent',
          boxShadow: 'none',
          '& .MuiBottomNavigation-root': { backgroundColor: 'transparent' },
          '& .MuiBottomNavigationAction-root': { color: 'rgba(255,255,255,0.7)' },
          '& .MuiBottomNavigationAction-root.Mui-selected': { color: '#fff' },
        }),
      }}
    >
      <BottomNavigation
        showLabels
        value={activeValue}
        sx={{
          height: MOBILE_BOTTOM_NAV_HEIGHT,
          // Jedes Item bekommt gleich viel Platz, schrumpft aber mit der Breite mit
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            flex: 1,
            px: 0.5,
            // Label-Schrift und Icon auf sehr schmalen Bildschirmen verkleinern
            fontSize: { xs: '0.6rem', sm: '0.75rem' },
            '& .MuiBottomNavigationAction-label': {
              fontSize: 'inherit',
              '&.Mui-selected': { fontSize: 'inherit' },
            },
            '& .MuiSvgIcon-root': {
              fontSize: { xs: '1.2rem', sm: '1.5rem' },
            },
          },
        }}
      >
        <BottomNavigationAction label="Dashboard" value="dashboard" icon={<DashboardIcon />}    onClick={() => go('/dashboard')} sx={{ '&.Mui-selected': { color: '#26A69A' } }} />
        <BottomNavigationAction label="Kalender"  value="calendar"  icon={<CalendarMonthIcon />} onClick={() => go('/calendar')}  sx={{ '&.Mui-selected': { color: '#FFA726' } }} />
        <BottomNavigationAction label="Spiele"    value="games"     icon={<SportsSoccerIcon />}  onClick={() => go('/games')}     sx={{ '&.Mui-selected': { color: '#EF5350' } }} />
        <BottomNavigationAction label="Mein Team" value="my-team"   icon={<GroupsIcon />}        onClick={() => go('/my-team')}   sx={{ '&.Mui-selected': { color: '#66BB6A' } }} />
        <BottomNavigationAction label="Mehr"      value="more"      icon={<MoreHorizIcon />}     onClick={onMobileMenuToggle} />
      </BottomNavigation>
    </Paper>
  );
}
