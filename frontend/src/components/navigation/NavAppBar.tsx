import React from 'react';
import AppBar from '@mui/material/AppBar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useTheme } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useAuth } from '../../context/AuthContext';
import { useHomeScroll } from '../../context/HomeScrollContext';
import { useNotifications } from '../../context/NotificationContext';
import { useUnreadMessageCount } from '../../hooks/useUnreadMessageCount';
import { useScrollShrink } from '../../hooks/useScrollShrink';
import { isPublicSeoPath } from '../../seo/siteConfig';
import UserAvatar from '../UserAvatar';

interface NavAppBarProps {
  onOpenAuth: () => void;
  onOpenNotifications: (e: React.MouseEvent<HTMLElement>) => void;
  onOpenUserMenu: (e: React.MouseEvent<HTMLElement>) => void;
}

export default function NavAppBar({ onOpenAuth, onOpenNotifications, onOpenUserMenu }: NavAppBarProps) {
  const { user, isAuthenticated } = useAuth();
  const { isOnHeroSection } = useHomeScroll();
  const { unreadCount } = useNotifications();
  const unreadMessageCount = useUnreadMessageCount();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const isScrolled = useScrollShrink(10);

  const isHome = location.pathname === '/' || location.pathname === '';
  const isPublicSeoRoute = isPublicSeoPath(location.pathname);
  const showLoginButton = !isHome || (isHome && isOnHeroSection);

  return (
    <AppBar
      position="fixed"
      sx={{
        background: isHome
          ? 'transparent'
          : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
        backgroundColor: 'transparent',
        boxShadow: 'none',
        color: isHome ? '#fff' : 'primary.contrastText',
        transition: 'background 0.3s, min-height 0.25s ease',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          color: isHome ? '#fff' : 'primary.contrastText',
          px: { xs: 1, sm: 2 },
          height: 'var(--app-header-height)',
          transition: 'height 0.25s ease',
          overflow: 'hidden',
        }}
      >
        {/* Logo — auf Desktop ausgeblendet wenn Sidebar sichtbar (zeigt eigenes Brand) */}
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => navigate('/')}
          title="Zur Startseite"
          style={{
            fontFamily: 'ImpactWeb, Impact, "Arial Black", sans-serif',
            fontSize: isScrolled ? '1.1rem' : '2rem',
            transition: 'font-size 0.25s ease',
          }}
        >
          {location.pathname !== '/' && (
            <>
              <span style={{ color: '#018606', textShadow: '0 1px 6px #fff, 0 0px 2px #fff' }}>K</span>ADERBLICK
            </>
          )}
        </Typography>

        {isAuthenticated ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Benachrichtigungen">
              <IconButton
                onClick={onOpenNotifications}
                sx={{ color: isHome ? '#fff' : theme.palette.primary.contrastText, p: 0.75, transition: 'padding 0.25s ease' }}
              >
                <Badge
                  badgeContent={unreadCount}
                  color="error"
                  max={99}
                  overlap="circular"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}
                >
                  {unreadCount > 0
                    ? <NotificationsIcon sx={{ fontSize: isScrolled ? '1.2rem' : '1.5rem', transition: 'font-size 0.25s ease' }} />
                    : <NotificationsNoneIcon sx={{ fontSize: isScrolled ? '1.2rem' : '1.5rem', transition: 'font-size 0.25s ease' }} />
                  }
                </Badge>
              </IconButton>
            </Tooltip>
            <IconButton
              aria-label="Benutzerkonto"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={onOpenUserMenu}
              sx={{ color: isHome ? '#fff' : theme.palette.primary.contrastText, p: 0.5, transition: 'padding 0.25s ease' }}
            >
              <Badge
                variant="dot"
                color="error"
                invisible={unreadMessageCount === 0}
                overlap="circular"
                sx={{ '& .MuiBadge-dot': { width: 8, height: 8, border: '1.5px solid', borderColor: isHome ? 'transparent' : theme.palette.primary.main } }}
              >
                <UserAvatar
                  icon={(user?.useGoogleAvatar && user?.googleAvatarUrl) ? user.googleAvatarUrl : (user?.avatarFile || undefined)}
                  name=""
                  avatarSize={isScrolled ? 22 : 32}
                  fontSize={isScrolled ? 11 : 16}
                  titleObj={user?.title?.hasTitle ? user.title : undefined}
                  svgFrameOffsetY={0}
                  level={user?.level?.level}
                />
              </Badge>
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!isMobile && isPublicSeoRoute && (
              <>
                <Button
                  onClick={() => navigate('/funktionen')}
                  className="navigation-transparent-btn"
                  sx={{ color: isHome ? '#fff' : theme.palette.primary.contrastText, fontWeight: 500 }}
                >
                  Funktionen
                </Button>
                <Button
                  component="a"
                  href="https://docs.kaderblick.de"
                  target="_blank"
                  rel="noreferrer"
                  className="navigation-transparent-btn"
                  sx={{ color: isHome ? '#fff' : theme.palette.primary.contrastText, fontWeight: 500 }}
                >
                  Dokumentation
                </Button>
                <Button
                  onClick={() => navigate('/kontakt')}
                  className="navigation-transparent-btn"
                  sx={{ color: isHome ? '#fff' : theme.palette.primary.contrastText, fontWeight: 500 }}
                >
                  Kontakt
                </Button>
              </>
            )}
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
                  '&:hover': { backgroundColor: 'primary.dark', boxShadow: 3 },
                  transition: 'all 0.3s ease',
                }}
              >
                Login / Register
              </Button>
            )}
          </Box>
        )}
      </Box>
    </AppBar>
  );
}
