import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
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
        transition: 'background 0.3s',
      }}
    >
      <Toolbar sx={{ color: isHome ? '#fff' : 'primary.contrastText' }}>
        {/* Logo — auf Desktop ausgeblendet wenn Sidebar sichtbar (zeigt eigenes Brand) */}
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => navigate('/')}
          title="Zur Startseite"
          style={{ fontFamily: 'ImpactWeb, Impact, "Arial Black", sans-serif', fontSize: '2rem' }}
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
                size="large"
                onClick={onOpenNotifications}
                sx={{ color: isHome ? '#fff' : theme.palette.primary.contrastText, p: 0.75 }}
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
              aria-label="Benutzerkonto"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={onOpenUserMenu}
              sx={{ color: isHome ? '#fff' : theme.palette.primary.contrastText, p: 0.5 }}
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
                  avatarSize={32}
                  fontSize={16}
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
      </Toolbar>
    </AppBar>
  );
}
