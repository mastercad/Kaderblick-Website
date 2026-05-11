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
import { useLocation } from 'react-router-dom';
import { useNavigationProgress } from '../../context/NavigationProgressContext';
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
  onOpenDemo: () => void;
  onOpenNotifications: (e: React.MouseEvent<HTMLElement>) => void;
  onOpenUserMenu: (e: React.MouseEvent<HTMLElement>) => void;
}

export default function NavAppBar({ onOpenAuth, onOpenDemo, onOpenNotifications, onOpenUserMenu }: NavAppBarProps) {
  const { user, isAuthenticated } = useAuth();
  const { isOnHeroSection } = useHomeScroll();
  const { unreadCount } = useNotifications();
  const unreadMessageCount = useUnreadMessageCount();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { navigateWithProgress: navigate } = useNavigationProgress();
  const location = useLocation();
  const isScrolled = useScrollShrink(10);

  const isHome = location.pathname === '/' || location.pathname === '';
  const isPublicSeoRoute = isPublicSeoPath(location.pathname);
  const showLoginButton = !user && (!isHome || isOnHeroSection || isPublicSeoRoute);
  const showHomeMarketingHeader = !user && isHome;

  const homeMenuItems = [
    { label: 'Funktionen', href: '#funktionen', active: true },
    { label: 'Vorteile', href: '/vorteile' },
    { label: 'Preise', href: '/preise' },
    { label: 'Ueber uns', href: '#ueber-uns' },
    { label: 'Kontakt', href: '/kontakt' },
  ];

  return (
    <AppBar
      position="fixed"
      sx={{
        background: showHomeMarketingHeader
          ? 'rgba(11, 14, 12, 0.92)'
          : isHome
          ? 'transparent'
          : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
        backdropFilter: showHomeMarketingHeader ? 'blur(14px)' : undefined,
        backgroundColor: 'transparent',
        boxShadow: 'none',
        color: isHome ? '#fff' : 'primary.contrastText',
        borderBottom: showHomeMarketingHeader ? '1px solid rgba(255,255,255,0.08)' : 'none',
        transition: 'background 0.3s, min-height 0.25s ease',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: showHomeMarketingHeader ? 'space-between' : 'flex-start',
          color: isHome ? '#fff' : 'primary.contrastText',
          px: { xs: 1.25, sm: 2, lg: 3 },
          height: 'var(--app-header-height)',
          transition: 'height 0.25s ease',
          overflow: 'hidden',
          gap: 2,
        }}
      >
        <Box
          sx={{
            flexGrow: showHomeMarketingHeader ? 0 : 1,
            cursor: 'pointer',
            userSelect: 'none',
            minWidth: 0,
            fontFamily: "'ImpactWeb', Impact, 'Arial Black', sans-serif",
            fontSize: showHomeMarketingHeader ? (isMobile ? '1.2rem' : '1.6rem') : (isScrolled ? '1.1rem' : '2rem'),
            letterSpacing: showHomeMarketingHeader ? '-0.03em' : undefined,
            lineHeight: 1,
            transition: 'font-size 0.25s ease',
          }}
          onClick={() => navigate('/')}
          title="Zur Startseite"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <img
              src="/images/kaderblick_website_appicon.svg"
              alt=""
              aria-hidden="true"
              style={{ height: '1em', width: 'auto', display: 'block', flexShrink: 0 }}
            />
            <span style={{ display: 'block' }}>
              {showHomeMarketingHeader ? (
                <>
                  <span style={{ fontFamily: "'ImpactWeb', Impact", color: '#34b74a' }}>K</span>
                  <span style={{ fontFamily: "'ImpactWeb', Impact", color: '#ffffff' }}>ADERBLICK</span>
                </>
              ) : (
                <>
                  <span style={{ color: '#018606', textShadow: '0 1px 6px #fff, 0 0px 2px #fff' }}>K</span>ADERBLICK
                </>
              )}
            </span>
          </span>
        </Box>

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
            {!isMobile && showHomeMarketingHeader && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mx: 'auto' }}>
                {homeMenuItems.map((item) => (
                  <Button
                    key={item.label}
                    component="a"
                    href={item.href}
                    className="navigation-transparent-btn"
                    sx={{
                      color: item.active ? '#ffffff' : 'rgba(255,255,255,0.82)',
                      fontWeight: item.active ? 700 : 500,
                      borderRadius: 999,
                      px: 1.4,
                      position: 'relative',
                      '&::after': item.active
                        ? {
                            content: '""',
                            position: 'absolute',
                            left: 16,
                            right: 16,
                            bottom: 4,
                            height: 2,
                            borderRadius: 999,
                            background: '#35b24c',
                          }
                        : undefined,
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Box>
            )}

            {!isMobile && isPublicSeoRoute && !showHomeMarketingHeader && (
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

            {showHomeMarketingHeader ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {showLoginButton && (
                  <Button
                    variant="outlined"
                    onClick={onOpenAuth}
                    sx={{
                      fontWeight: 600,
                      borderRadius: '0.8rem',
                      minWidth: 'auto',
                      px: { xs: 1.25, sm: 1.8 },
                      py: 0.85,
                      borderColor: 'rgba(255,255,255,0.55)',
                      color: '#ffffff',
                      textTransform: 'none',
                    }}
                  >
                    Login
                  </Button>
                )}
                <Button
                  onClick={onOpenDemo}
                  variant="contained"
                  sx={{
                    fontWeight: 700,
                    borderRadius: '0.8rem',
                    minWidth: 'auto',
                    px: { xs: 1.4, sm: 2 },
                    py: 0.9,
                    textTransform: 'none',
                    background: 'linear-gradient(180deg, #35b24c 0%, #1f9739 100%)',
                    color: '#ffffff',
                    boxShadow: 'none',
                  }}
                >
                  Demo anfragen
                </Button>
              </Box>
            ) : (
              !user && showLoginButton && (
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
              )
            )}
          </Box>
        )}
      </Box>
    </AppBar>
  );
}
