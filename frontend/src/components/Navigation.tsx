import { useNavigate, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import GroupsIcon from '@mui/icons-material/Groups';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import LayersIcon from '@mui/icons-material/Layers';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ShieldIcon from '@mui/icons-material/Shield';
import PersonBadgeIcon from '@mui/icons-material/Badge';
import PersonIcon from '@mui/icons-material/Person';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import RoomIcon from '@mui/icons-material/Room';
import FeedbackIcon from '@mui/icons-material/Feedback';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import SearchIcon from '@mui/icons-material/Search';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import BusinessIcon from '@mui/icons-material/Business';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import VideocamIcon from '@mui/icons-material/Videocam';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import PublicIcon from '@mui/icons-material/Public';
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import PollIcon from '@mui/icons-material/Poll';
import SettingsIcon from '@mui/icons-material/Settings';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import NewsIcon from '@mui/icons-material/Article';
import MessageIcon from '@mui/icons-material/Message';
import EventIcon from '@mui/icons-material/Event';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteIcon from '@mui/icons-material/Delete';
import HomeIcon from '@mui/icons-material/Home';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListItemIcon from '@mui/material/ListItemIcon';
import Badge from '@mui/material/Badge';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import React, { useState, useMemo } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme, alpha } from '@mui/material/styles';
import { useAuth } from '../context/AuthContext';
import { useHomeScroll } from '../context/HomeScrollContext';
import { apiJson } from '../utils/api';
import RegistrationContextDialog from '../modals/RegistrationContextDialog';
import LinkIcon from '@mui/icons-material/Link';
import { useNotifications } from '../context/NotificationContext';
import { AppNotification } from '../types/notifications';
import { NotificationDetailModal } from './NotificationDetailModal';
import NavigationMessagesButton from './NavigationMessagesButton';
import { BACKEND_URL } from '../../config';
import UserAvatar from './UserAvatar';
import { getAvatarFrameUrl } from '../utils/avatarFrame';

interface NavigationProps {
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenQRShare: () => void;
}

const MOBILE_BOTTOM_NAV_HEIGHT = 56;
const MOBILE_BOTTOM_NAV_SAFE_AREA = 'env(safe-area-inset-bottom, 0px)';

type ViewportPinnedNavStyle = {
  left: number;
  top: number;
  width: number;
};

const isIosStandalonePwa = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const isIos = /iP(hone|ad|od)/.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

  if (!isIos) {
    return false;
  }

  const standaloneNavigator = window.navigator as Navigator & { standalone?: boolean };
  const isStandalone = standaloneNavigator.standalone === true;
  const isStandaloneDisplayMode = window.matchMedia?.('(display-mode: standalone)').matches === true
    || window.matchMedia?.('(display-mode: fullscreen)').matches === true
    || window.matchMedia?.('(display-mode: minimal-ui)').matches === true;

  return isStandalone || isStandaloneDisplayMode;
};

function useViewportPinnedBottomNav(enabled: boolean, navHeight: number): ViewportPinnedNavStyle | null {
  const [style, setStyle] = React.useState<ViewportPinnedNavStyle | null>(null);

  React.useLayoutEffect(() => {
    if (!enabled || typeof window === 'undefined' || !isIosStandalonePwa() || !window.visualViewport) {
      setStyle(null);
      return undefined;
    }

    const viewport = window.visualViewport;
    let frameId = 0;

    const update = () => {
      frameId = 0;

      const nextStyle = {
        left: Math.round(viewport.offsetLeft),
        top: Math.round(viewport.offsetTop + viewport.height - navHeight),
        width: Math.round(viewport.width),
      };

      setStyle(prev => {
        if (
          prev
          && prev.left === nextStyle.left
          && prev.top === nextStyle.top
          && prev.width === nextStyle.width
        ) {
          return prev;
        }

        return nextStyle;
      });
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(update);
    };

    scheduleUpdate();

    viewport.addEventListener('resize', scheduleUpdate);
    viewport.addEventListener('scroll', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    document.addEventListener('visibilitychange', scheduleUpdate);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }

      viewport.removeEventListener('resize', scheduleUpdate);
      viewport.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
      window.removeEventListener('pageshow', scheduleUpdate);
      document.removeEventListener('visibilitychange', scheduleUpdate);
    };
  }, [enabled, navHeight]);

  return style;
}

const getNotificationIcon = (type: AppNotification['type']) => {
  switch (type) {
    case 'news': return <NewsIcon fontSize="small" />;
    case 'message': return <MessageIcon fontSize="small" />;
    case 'participation': return <EventIcon fontSize="small" />;
    case 'team_ride':
    case 'team_ride_booking':
    case 'team_ride_cancel':
    case 'team_ride_deleted':
      return <DirectionsCarIcon fontSize="small" />;
    case 'event_cancelled': return <EventBusyIcon fontSize="small" />;
    case 'feedback': return <FeedbackIcon fontSize="small" />;
    default: return <NotificationsNoneIcon fontSize="small" />;
  }
};

const formatNotifTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `Vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Vor ${hours} Std.`;
  if (hours < 48) return 'Gestern';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const isToday = (date: Date) => new Date().toDateString() === date.toDateString();
const isYesterday = (date: Date) => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return y.toDateString() === date.toDateString();
};

export default function Navigation({ onOpenAuth, onOpenProfile, onOpenQRShare }: NavigationProps) {
  const { user, isAuthenticated, logout, isSuperAdmin } = useAuth();
  const { isOnHeroSection } = useHomeScroll();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const viewportPinnedBottomNav = useViewportPinnedBottomNav(isMobile && isAuthenticated, MOBILE_BOTTOM_NAV_HEIGHT);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [trainerDrawerOpen, setTrainerDrawerOpen] = useState(false);
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false);
  const [userRelations, setUserRelations] = useState<{ id: number }[]>([]);
  const [showRelationModal, setShowRelationModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';

  React.useEffect(() => {
    if (!isAuthenticated) { setUserRelations([]); return; }
    apiJson('/api/users/relations').then(data => setUserRelations(Array.isArray(data) ? data : [])).catch(() => setUserRelations([]));
  }, [isAuthenticated]);

  // Helper: prüfe ob ein Nav-Key aktiv ist (auch bei Sub-Routen)
  const isNavItemActive = (key: string): boolean => {
    const path = location.pathname;
    if (key === 'home') return path === '/' || path === '';
    // "surveys" deckt auch /survey/fill/:id ab
    if (key === 'surveys') return path === '/surveys' || path.startsWith('/surveys/') || path.startsWith('/survey/');
    return path === `/${key}` || path.startsWith(`/${key}/`);
  };

  // Show button: either not on home page, OR on home page but on hero section
  const showLoginButton = !isHome || (isHome && isOnHeroSection);

  // Rollen-Flags
  const rolesArrayEarly = Object.values(user?.roles || {});
  const isAdminEarly = rolesArrayEarly.includes('ROLE_ADMIN') || rolesArrayEarly.includes('ROLE_SUPERADMIN');
  const isCoach = user?.isCoach || false;
  const isPlayer = user?.isPlayer || false;

  // Rollenbasierte Navigation:
  // Spieler:  Home · Mein Team · Kalender · Spiele · Aufgaben · Auswertungen
  // Eltern:   Home · Mein Team · Kalender · Neuigkeiten · Nachrichten
  // Trainer:  Home · Mein Team · Kalender · Spiele · Aufstellungen · Auswertungen
  // Admin:    + Administration Dropdown
  const navigationItems = useMemo(() => {
    const items: Array<{ key: string; label: string; disabled: boolean; icon?: React.ReactNode }> = [
      { key: 'home', label: 'Home', disabled: false },
      { key: 'dashboard', label: 'Dashboard', disabled: false },
      { key: 'my-team', label: 'Mein Team', disabled: false },
      { key: 'calendar', label: 'Kalender', disabled: false },
      { key: 'games', label: 'Spiele', disabled: false },
    ];

    /*
    // Aufgaben für Spieler (und alle Nicht-Trainer/Nicht-Admin als Basis-Nutzer)
    if (isPlayer || (!isCoach && !isAdminEarly)) {
      items.push({ key: 'tasks', label: 'Aufgaben', disabled: false, icon: <AssignmentIcon fontSize="small" /> });
    }
    */

    // Auswertungen (für Trainer/Spieler/Admin)
    items.push({ key: 'reports', label: 'Auswertungen', disabled: false, icon: <BarChartIcon fontSize="small" /> });

    // Neuigkeiten & Umfragen als "Mehr"-Bereich im Menü oder direkt
    items.push({ key: 'news', label: 'Neuigkeiten', disabled: false, icon: <NewspaperIcon fontSize="small" /> });
    items.push({ key: 'surveys', label: 'Umfragen', disabled: false, icon: <PollIcon fontSize="small" /> });
    items.push({ key: 'mein-feedback', label: 'Mein Feedback', disabled: false, icon: <FeedbackIcon fontSize="small" /> });
    items.push({ key: 'tasks', label: 'Meine Aufgaben', disabled: false, icon: <AssignmentIcon fontSize="small" /> });

    return items;
  }, [isPlayer, isCoach, isAdminEarly]);

  const trainerMenuItems = [
    { key: 'team-size-guide', label: 'Team Size Guide', icon: <CheckroomIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
    { key: 'formations', label: 'Aufstellungen', icon: <GroupWorkIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
    { key: 'players', label: 'Spieler', icon: <PersonIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
    { key: 'teams', label: 'Teams', icon: <GroupsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
  ];

  const adminMenuSections = [
    {
      section: 'Stammdaten',
      items: [
        { label: 'Altersgruppen', page: 'ageGroups', icon: <GroupsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Ligen', page: 'leagues', icon: <EmojiEventsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Pokale', page: 'cups', icon: <WorkspacePremiumIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Positionen', page: 'positions', icon: <CenterFocusStrongIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Füße', page: 'strongFeets', icon: <DirectionsRunIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Beläge', page: 'surfaceTypes', icon: <LayersIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Ereignistypen', page: 'gameEventTypes', icon: <LocalOfferIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Nationalitäten', page: 'nationalities', icon: <PublicIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Trainer-Lizensen', page: 'coachLicenses', icon: <SchoolIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Kameras', page: 'cameras', icon: <CameraAltIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Videotypen', page: 'videoTypes', icon: <VideocamIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
      ],
    },
    {
      section: 'Verwaltung',
      items: [
        { label: 'Vereine', page: 'clubs', icon: <ShieldIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Trainer', page: 'coaches', icon: <PersonBadgeIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Spieler', page: 'players', icon: <PersonIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Spielstätten', page: 'locations', icon: <RoomIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Teams', page: 'teams', icon: <GroupsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Feedback', page: 'admin/feedback', icon: <FeedbackIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Neuigkeiten Management', page: 'news', icon: <NewspaperIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Datenkonsistenz', href: 'admin/consistency', icon: <SearchIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Aufstellungen', page: 'formations', icon: <GroupWorkIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Aufgaben', page: 'tasks', icon: <ManageAccountsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        { label: 'Titel & XP Übersicht', page: 'admin/title-xp-overview', icon: <EmojiEventsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
        ...(isSuperAdmin ? [{ label: 'XP-Konfiguration', page: 'admin/xp-config', icon: <EmojiEventsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
        ...(isSuperAdmin ? [{ label: 'Nutzeraktivität', page: 'admin/activity', icon: <BarChartIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
        ...(isSuperAdmin ? [{ label: 'System-Einstellungen', page: 'admin/system-settings', icon: <SettingsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> }] : []),
      ],
    },
    {
      section: 'Zuweisungen',
      items: [
        { label: 'Benutzer', page: 'admin/user-relations', icon: <ManageAccountsIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
{/*        { label: 'Spieler zu Team', href: '/api/player_team_assignments', icon: <PersonAddIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} /> },
        { label: 'Spieler zu Verein', href: '/api/player_club_assignments', icon: <HandshakeIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} /> },
        { label: 'Coach zu Team', href: '/api/coach_team_assignments', icon: <SwapHorizIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} /> },
        { label: 'Coach zu Verein', href: '/api/coach_club_assignments', icon: <BusinessIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} /> }*/},
        { label: 'Videos', href: '/videos/upload', icon: <VideoLibraryIcon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} /> },
      ],
    },
  ];

  const {
    notifications,
    unreadCount,
    markAllAsRead,
    clearAll,
    selectedNotification,
    openNotificationDetail,
    closeNotificationDetail,
  } = useNotifications();

  const [adminMenuAnchor, setAdminMenuAnchor] = useState<null | HTMLElement>(null);
  const handleAdminMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAdminMenuAnchor(event.currentTarget);
  };
  const handleAdminMenuClose = () => {
    setAdminMenuAnchor(null);
  };

  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const handleNotifOpen = (event: React.MouseEvent<HTMLElement>) => setNotifAnchorEl(event.currentTarget);
  const handleNotifClose = () => setNotifAnchorEl(null);

  const [trainerMenuAnchor, setTrainerMenuAnchor] = useState<null | HTMLElement>(null);
  const handleTrainerMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setTrainerMenuAnchor(event.currentTarget);
  };
  const handleTrainerMenuClose = () => {
    setTrainerMenuAnchor(null);
  };
  const handleTrainerMenuClick = (key: string) => {
    navigate(`/${key}`);
    handleTrainerMenuClose();
    handleMobileMenuClose();
  };

  // "Mehr"-Dropdown für Desktop (sekundäre Items)
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const handleMoreMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMoreMenuAnchor(event.currentTarget);
  };
  const handleMoreMenuClose = () => {
    setMoreMenuAnchor(null);
  };

  // Desktop: Primäre Items direkt sichtbar, sekundäre im "Mehr"-Dropdown
  const primaryDesktopKeys = ['home', 'dashboard', 'my-team', 'calendar', 'games', 'reports'];
  const primaryNavItems = navigationItems.filter(item => primaryDesktopKeys.includes(item.key));
  const secondaryNavItems = navigationItems.filter(item => !primaryDesktopKeys.includes(item.key));

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    handleClose();
  };

  const handleMobileMenuToggle = () => {
    const newState = !mobileMenuOpen;
    setMobileMenuOpen(newState);
    if (newState) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
  };

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
    document.body.classList.remove('menu-open');
  };
  // Drawer-Open-States überwachen
  React.useEffect(() => {
    if (mobileMenuOpen || trainerDrawerOpen || adminDrawerOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
  }, [mobileMenuOpen, trainerDrawerOpen, adminDrawerOpen]);

  const handlePageChangeAndClose = (page: string) => {
    navigate(`/${page}`);
    handleMobileMenuClose();
  };

  // Verwende die oben bereits berechneten Rollen-Flags
  const isAdmin = isAdminEarly;

  // Aktiv-Status für Dropdown-Menüs (Sub-Routen-aware)
  const isAnySecondaryActive = secondaryNavItems.some(item => isNavItemActive(item.key));
  const isAnyTrainerActive = trainerMenuItems.some(item => isNavItemActive(item.key));
  const isAnyAdminActive = adminMenuSections.some(section =>
    section.items.some(item => {
      const p = item.page || item.href || '';
      return location.pathname === `/${p}` || location.pathname.startsWith(`/${p}/`);
    })
  );

  return (
    <>
      {/* Platzhalter für festen Header – nicht auf der Home-Seite (transparente Nav) */}
      {!isHome && <Box sx={{ height: { xs: 56, md: 64 } }} />}
      
      <AppBar
        position="fixed"
        sx={{
          background: isHome
            ? 'transparent'
            : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          backgroundColor: 'transparent',
          boxShadow: 'none',
          color: isHome
            ? '#fff'
            : 'primary.contrastText',
          transition: 'background 0.3s',
        }}
      >
        <Toolbar sx={{ 
          color: isHome
            ? '#fff'
            : 'primary.contrastText',
          }}>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, cursor: 'pointer', userSelect: 'none' }}
            onClick={() => navigate('/')}
            title="Zur Startseite"
            style={{ fontFamily: 'ImpactWeb, Impact, \"Arial Black\", sans-serif', fontSize: '2rem' }}
          >
            {location.pathname !== '/' && (
              <>
                <span style={{ color: '#018606', textShadow: '0 1px 6px #fff, 0 0px 2px #fff' }}>K</span>ADERBLICK
              </>
            )}
          </Typography>

          {isAuthenticated ? (
            <>
              {/* Desktop Navigation */}
              {!isMobile && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {/* Primäre Navi-Punkte */}
                  {primaryNavItems.map((item) => (
                    <Button
                      key={item.key}
                      disabled={item.disabled}
                      onClick={() => !item.disabled && navigate(`/${item.key === 'home' ? '' : item.key}`)}
                      className="navigation-transparent-btn"
                      sx={{
                        color: isHome
                          ? '#fff'
                          : theme.palette.primary.contrastText,
                        fontWeight: isNavItemActive(item.key) ? 700 : 500,
                        borderRadius: 2,
                        minWidth: 'auto',
                        px: 1.5,
                        py: 1,
                        fontSize: '0.85rem',
                        borderBottom: isNavItemActive(item.key)
                          ? '2px solid currentColor'
                          : '2px solid transparent',
                      }}
                    >
                      {item.label}
                    </Button>
                  ))}

                  {/* "Mehr" Dropdown für sekundäre Items (Neuigkeiten, Umfragen) */}
                  {secondaryNavItems.length > 0 && (
                    <>
                      <Button
                        onClick={handleMoreMenuOpen}
                        className="navigation-transparent-btn"
                        sx={{
                          color: isHome
                            ? '#fff'
                            : theme.palette.primary.contrastText,
                          fontWeight: isAnySecondaryActive ? 700 : 500,
                          borderRadius: 2,
                          minWidth: 'auto',
                          px: 1.5,
                          py: 1,
                          fontSize: '0.85rem',
                          borderBottom: isAnySecondaryActive
                            ? '2px solid currentColor'
                            : '2px solid transparent',
                        }}
                        endIcon={<ArrowDropDownIcon />}
                      >
                        Mehr
                      </Button>
                      <Menu
                        anchorEl={moreMenuAnchor}
                        open={Boolean(moreMenuAnchor)}
                        onClose={handleMoreMenuClose}
                      >
                        {secondaryNavItems.map((item) => (
                          <MenuItem
                            key={item.key}
                            selected={isNavItemActive(item.key)}
                            onClick={() => {
                              handleMoreMenuClose();
                              navigate(`/${item.key}`);
                            }}
                          >
                            {item.icon && <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>{item.icon}</Box>}
                            {item.label}
                          </MenuItem>
                        ))}
                      </Menu>
                    </>
                  )}
                  {/* Trainer Dropdown */}
                  {user?.isCoach && (
                    <>
                      <Button
                        onClick={handleTrainerMenuOpen}
                        className="navigation-transparent-btn"
                        sx={{
                          color: isHome
                            ? '#fff'
                            : theme.palette.primary.contrastText,
                          fontWeight: isAnyTrainerActive ? 700 : 500,
                          borderRadius: 2,
                          minWidth: 'auto',
                          px: 2,
                          py: 1,
                          borderBottom: isAnyTrainerActive
                            ? '2px solid currentColor'
                            : '2px solid transparent',
                        }}
                        endIcon={<ArrowDropDownIcon />}
                      >
                        Trainer
                      </Button>
                      <Menu
                        anchorEl={trainerMenuAnchor}
                        open={Boolean(trainerMenuAnchor)}
                        onClose={handleTrainerMenuClose}
                      >
                        {trainerMenuItems.map((item) => (
                          <MenuItem
                            key={item.key}
                            selected={isNavItemActive(item.key)}
                            onClick={() => handleTrainerMenuClick(item.key)}
                          >
                            {item.icon}
                            {item.label}
                          </MenuItem>
                        ))}
                      </Menu>
                    </>
                  )}
                  {/* Admin Dropdown */}
                  {isAdmin && (
                    <>
                      <Button
                        onClick={handleAdminMenuOpen}
                        className="navigation-transparent-btn"
                        sx={{
                          color: isHome
                            ? '#fff'
                            : theme.palette.primary.contrastText,
                          fontWeight: isAnyAdminActive ? 700 : 500,
                          borderRadius: 2,
                          minWidth: 'auto',
                          px: 2,
                          py: 1,
                          borderBottom: isAnyAdminActive
                            ? '2px solid currentColor'
                            : '2px solid transparent',
                        }}
                        endIcon={<ArrowDropDownIcon />}
                      >
                        Administration
                      </Button>
                      <Menu
                        anchorEl={adminMenuAnchor}
                        open={Boolean(adminMenuAnchor)}
                        onClose={handleAdminMenuClose}
                        MenuListProps={{ sx: { minWidth: 250 } }}
                      >
                        {adminMenuSections.map((section) => (
                          <Box key={section.section}>
                            <MenuItem disabled>
                              <Typography variant="subtitle2"
                                sx={{
                                  color: 'text.primary',
                                }}
                              >
                                {section.section}
                              </Typography>
                            </MenuItem>
                            {section.items.map((item) => (
                              <MenuItem
                                key={item.label}
                                selected={location.pathname === `/${item.page || item.href}`}
                                sx={{
                                  pl: 3,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                onClick={() => {
                                  handleAdminMenuClose();
                                  if (item.page) {
                                    navigate(`/${item.page}`);
                                  }
                                }}
                              >
                                {item.icon}
                                {item.label}
                              </MenuItem>
                            ))}
                            <Divider />
                          </Box>
                        ))}
                      </Menu>
                    </>
                  )}
                </Box>
              )}

              {/* Common Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Notification Bell */}
                <Tooltip title="Benachrichtigungen">
                  <IconButton
                    size="large"
                    onClick={handleNotifOpen}
                    sx={{
                      color: isHome ? '#fff' : theme.palette.primary.contrastText,
                      p: 0.75,
                    }}
                  >
                    <Badge
                      badgeContent={unreadCount}
                      color="error"
                      max={99}
                      overlap="circular"
                      sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}
                    >
                      {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
                    </Badge>
                  </IconButton>
                </Tooltip>
                <IconButton
                  size="large"
                  aria-label="account of current user"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenu}
                  sx={{ 
                    color: isHome
                      ? '#fff'
                      : theme.palette.primary.contrastText,
                    p: 0.5,
                  }}
                >
                  <UserAvatar
                    icon={(user?.useGoogleAvatar && user?.googleAvatarUrl) ? user.googleAvatarUrl : (user?.avatarFile || undefined)}
                    name=""
                    avatarSize={32}
                    fontSize={16}
                    titleObj={user?.title && user?.title.hasTitle ? user.title : undefined}
                    svgFrameOffsetY={0}
                    level={user?.level?.level}
                  />
                </IconButton>
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {!user && showLoginButton && (
                <Button
                  variant="contained"
                  onClick={onOpenAuth}
                  sx={{
                    fontWeight: 500,
                    borderRadius: 2,
                    minWidth: 'auto',
                    px: 2,
                    py: 1,
                    color: theme.palette.primary.contrastText,
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                      boxShadow: 3,
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  Login / Register
                </Button>
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile: "Mehr" Bottom Sheet */}
      <Drawer
        anchor="bottom"
        open={mobileMenuOpen}
        onClose={handleMobileMenuClose}
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

        <List dense>
          {/* Sekundäre Nav-Items (Neuigkeiten, …) */}
          {navigationItems
            .filter(item => !['home', 'dashboard', 'my-team', 'calendar', 'games'].includes(item.key))
            .map((item) => (
              <ListItem key={item.key} disablePadding>
                <ListItemButton
                  selected={isNavItemActive(item.key)}
                  disabled={item.disabled}
                  onClick={() => !item.disabled && handlePageChangeAndClose(item.key)}
                >
                  {item.icon && (
                    <ListItemIcon sx={{ minWidth: 36, color: isNavItemActive(item.key) ? 'primary.main' : 'text.secondary' }}>
                      {item.icon}
                    </ListItemIcon>
                  )}
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))
          }

          {/* Nachrichten */}
          <NavigationMessagesButton variant="icon-with-text" text="Nachrichten" />

          {/* Trainer Untermenü (Accordion) */}
          {user?.isCoach && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <ListItem disablePadding>
                <ListItemButton
                  selected={isAnyTrainerActive}
                  onClick={() => setTrainerDrawerOpen((prev: boolean) => !prev)}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                    <GroupWorkIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Trainer" />
                  {trainerDrawerOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              </ListItem>
              <Collapse in={trainerDrawerOpen} timeout="auto" unmountOnExit>
                {trainerMenuItems.map((item) => (
                  <ListItem key={item.key} disablePadding sx={{ pl: 2 }}>
                    <ListItemButton
                      selected={isNavItemActive(item.key)}
                      onClick={() => handleTrainerMenuClick(item.key)}
                    >
                      {item.icon}
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </Collapse>
            </>
          )}

          {/* Admin Untermenü (Accordion) */}
          {isAdmin && (
            <>
              <Divider sx={{ my: 0.5 }} />
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => setAdminDrawerOpen((prev: boolean) => !prev)}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                    <ManageAccountsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Administration" />
                  {adminDrawerOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
              </ListItem>
              <Collapse in={adminDrawerOpen} timeout="auto" unmountOnExit>
                {adminMenuSections.map((section) => (
                  <Box key={section.section}>
                    <ListItem disablePadding sx={{ pl: 2 }}>
                      <ListItemButton disabled>
                        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {section.section}
                        </Typography>
                      </ListItemButton>
                    </ListItem>
                    {section.items.map((item) => (
                      <ListItem key={item.label} disablePadding sx={{ pl: 4 }}>
                        <ListItemButton
                          selected={location.pathname === `/${item.page || item.href}`}
                          onClick={() => {
                            handleMobileMenuClose();
                            if (item.page) navigate(`/${item.page}`);
                            else if (item.href) navigate(item.href);
                          }}
                        >
                          {item.icon}
                          <ListItemText primary={item.label} sx={{ ml: 1 }} />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </Box>
                ))}
              </Collapse>
            </>
          )}

          {/* QR-Code */}
          <Divider sx={{ my: 0.5 }} />
          <ListItem disablePadding>
            <ListItemButton onClick={() => { handleMobileMenuClose(); onOpenQRShare(); }}>
              <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                <QrCode2Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Registrierungs-QR-Code teilen" />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      {/* Mobile Bottom Navigation Bar */}
      {isMobile && isAuthenticated && (
        <Paper
          sx={{
            position: 'fixed',
            zIndex: 1100,
            left: viewportPinnedBottomNav ? `${viewportPinnedBottomNav.left}px` : 0,
            right: viewportPinnedBottomNav ? 'auto' : 0,
            top: viewportPinnedBottomNav ? `${viewportPinnedBottomNav.top}px` : 'auto',
            bottom: viewportPinnedBottomNav ? 'auto' : 0,
            width: viewportPinnedBottomNav ? `${viewportPinnedBottomNav.width}px` : 'auto',
            minHeight: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + ${MOBILE_BOTTOM_NAV_SAFE_AREA})`,
            pb: MOBILE_BOTTOM_NAV_SAFE_AREA,
            boxSizing: 'border-box',
            overflow: 'hidden',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            willChange: viewportPinnedBottomNav ? 'top, left, width' : 'auto',
            ...(isHome && {
              background: 'transparent',
              boxShadow: 'none',
              '& .MuiBottomNavigation-root': {
                backgroundColor: 'transparent',
              },
              '& .MuiBottomNavigationAction-root': {
                color: 'rgba(255,255,255,0.7)',
              },
              '& .MuiBottomNavigationAction-root.Mui-selected': {
                color: '#fff',
              },
            }),
          }}
          elevation={isHome ? 0 : 4}
        >
          <BottomNavigation
            showLabels
            value={['dashboard', 'my-team', 'calendar', 'games'].find(k => isNavItemActive(k)) ?? (mobileMenuOpen ? 'more' : false)}
            sx={{ height: MOBILE_BOTTOM_NAV_HEIGHT }}
          >
            <BottomNavigationAction
              label="Dashboard"
              value="dashboard"
              icon={<DashboardIcon />}
              onClick={() => { handleMobileMenuClose(); navigate('/dashboard'); }}
            />
            <BottomNavigationAction
              label="Kalender"
              value="calendar"
              icon={<CalendarMonthIcon />}
              onClick={() => { handleMobileMenuClose(); navigate('/calendar'); }}
            />
            <BottomNavigationAction
              label="Spiele"
              value="games"
              icon={<SportsSoccerIcon />}
              onClick={() => { handleMobileMenuClose(); navigate('/games'); }}
            />
            <BottomNavigationAction
              label="Mein Team"
              value="my-team"
              icon={<GroupsIcon />}
              onClick={() => { handleMobileMenuClose(); navigate('/my-team'); }}
            />
            <BottomNavigationAction
              label="Mehr"
              value="more"
              icon={<MoreHorizIcon />}
              onClick={handleMobileMenuToggle}
            />
          </BottomNavigation>
        </Paper>
      )}

      {/* User Menu */}
      <Menu
        id="menu-appbar"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        {/* User info */}
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Box>
            <Typography variant="subtitle2">{user?.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {user?.email}
            </Typography>
          </Box>
        </MenuItem>
        <Divider />

        <MenuItem onClick={() => { handleClose(); onOpenProfile(); }}>
          <AccountCircleIcon fontSize="small" 
            sx={{
              color: 'text.primary',
              mr: 1
            }} />
          Profil
        </MenuItem>
        {userRelations.length === 0 && (
          <MenuItem onClick={() => { handleClose(); setShowRelationModal(true); }}>
            <LinkIcon fontSize="small" sx={{ color: 'warning.main', mr: 1 }} />
            Verknüpfung anfragen
          </MenuItem>
        )}
        <MenuItem onClick={() => { handleClose(); onOpenQRShare(); }}>
          <QrCode2Icon fontSize="small" sx={{ color: 'text.primary', mr: 1 }} />
          Registrierungs-QR-Code
        </MenuItem>
        <NavigationMessagesButton 
          variant="icon-with-text" 
          text="Nachrichten" 
        />
        <MenuItem onClick={handleLogout}>
          <LogoutIcon fontSize="small" sx={{
            color: 'text.primary',
            mr: 1 }}
          />
          Logout
        </MenuItem>
      </Menu>

      {/* ── Notification Center Popover ── */}
      <Popover
        open={Boolean(notifAnchorEl)}
        anchorEl={notifAnchorEl}
        onClose={handleNotifClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          elevation: 8,
          sx: {
            width: 400,
            maxHeight: 540,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            mt: 1,
            borderRadius: 2,
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
          background: theme.palette.background.paper,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={700}>Benachrichtigungen</Typography>
            {unreadCount > 0 && (
              <Box sx={{
                bgcolor: 'error.main', color: '#fff',
                fontSize: '0.7rem', fontWeight: 700,
                borderRadius: '10px', px: 0.75, py: 0.1, lineHeight: 1.6,
              }}>
                {unreadCount}
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {unreadCount > 0 && (
              <Tooltip title="Alle als gelesen markieren">
                <IconButton size="small" onClick={() => markAllAsRead()}>
                  <DoneAllIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            {notifications.length > 0 && (
              <Tooltip title="Alle löschen">
                <IconButton size="small" onClick={() => clearAll()}>
                  <DeleteIcon sx={{ fontSize: 18 }} />
                </IconButton>
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
            {(() => {
              const todayItems = notifications.filter(n => isToday(new Date(n.timestamp)));
              const yesterdayItems = notifications.filter(n => isYesterday(new Date(n.timestamp)));
              const olderItems = notifications.filter(n => !isToday(new Date(n.timestamp)) && !isYesterday(new Date(n.timestamp)));

              const renderItem = (n: AppNotification) => (
                <Box
                  key={n.id}
                  onClick={() => { handleNotifClose(); openNotificationDetail(n); }}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    px: 2,
                    py: 1.25,
                    cursor: 'pointer',
                    borderLeft: `3px solid ${n.read ? 'transparent' : theme.palette.primary.main}`,
                    backgroundColor: n.read ? 'transparent' : alpha(theme.palette.primary.main, 0.04),
                    transition: 'background-color 0.15s',
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
                  }}
                >
                  <Box sx={{
                    mt: 0.25,
                    color: n.read ? 'text.disabled' : 'primary.main',
                    flexShrink: 0,
                  }}>
                    {getNotificationIcon(n.type)}
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight={n.read ? 400 : 600}
                      noWrap
                      sx={{ color: n.read ? 'text.secondary' : 'text.primary' }}
                    >
                      {n.title}
                    </Typography>
                    {n.message && (
                      <Typography variant="caption" color="text.secondary" sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.4,
                        mt: 0.2,
                      }}>
                        {n.message}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.4 }}>
                      {formatNotifTime(new Date(n.timestamp))}
                    </Typography>
                  </Box>
                  {!n.read && (
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: 'primary.main', flexShrink: 0, mt: 0.5,
                    }} />
                  )}
                </Box>
              );

              return (
                <>
                  {todayItems.length > 0 && (
                    <>
                      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                        <Typography variant="caption" fontWeight={700} color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.68rem' }}>
                          Heute
                        </Typography>
                      </Box>
                      {todayItems.map(renderItem)}
                    </>
                  )}
                  {yesterdayItems.length > 0 && (
                    <>
                      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                        <Typography variant="caption" fontWeight={700} color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.68rem' }}>
                          Gestern
                        </Typography>
                      </Box>
                      {yesterdayItems.map(renderItem)}
                    </>
                  )}
                  {olderItems.length > 0 && (
                    <>
                      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                        <Typography variant="caption" fontWeight={700} color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.68rem' }}>
                          Früher
                        </Typography>
                      </Box>
                      {olderItems.map(renderItem)}
                    </>
                  )}
                </>
              );
            })()}
          </Box>
        )}
      </Popover>

      <NotificationDetailModal
        notification={selectedNotification}
        open={Boolean(selectedNotification)}
        onClose={closeNotificationDetail}
      />

      <RegistrationContextDialog
        open={showRelationModal}
        onClose={() => setShowRelationModal(false)}
      />
    </>
  );
}