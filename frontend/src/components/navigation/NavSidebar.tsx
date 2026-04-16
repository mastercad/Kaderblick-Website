import React, { useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import MessageIcon from '@mui/icons-material/Message';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTheme, alpha } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useNavConfig, navItemIconMap, navItemColorMap, isNavItemActive } from './navigationConfig';

export const SIDEBAR_EXPANDED_WIDTH  = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 56;
export const SIDEBAR_STORAGE_KEY     = 'kb_sidebar_collapsed';

interface NavSidebarProps {
  openMessages: () => void;
  onOpenQRShare: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function NavSidebar({ openMessages, onOpenQRShare, collapsed, onToggle }: NavSidebarProps) {
  const { navigationItems, trainerMenuItems, adminMenuSections, isAdmin, isCoach } = useNavConfig();
  const { notifications } = useNotifications();
  const unreadMessageCount = notifications.filter(n => n.type === 'message' && !n.read).length;
  const theme = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // scrollContainerRef: the inner scrollable div
  // activeItemRef:      the currently selected list item
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef      = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const item      = activeItemRef.current;
    if (!container || !item) return;

    const itemTop    = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const visTop     = container.scrollTop;
    const visBottom  = visTop + container.clientHeight;

    if (itemTop < visTop) {
      container.scrollTo({ top: itemTop - 8, behavior: 'smooth' });
    } else if (itemBottom > visBottom) {
      container.scrollTo({ top: itemBottom - container.clientHeight + 8, behavior: 'smooth' });
    }
  }, [pathname]);

  const setActiveRef = (el: HTMLElement | null) => { activeItemRef.current = el; };
  const isActive     = (key: string) => isNavItemActive(pathname, key);

  const iconSx = (active: boolean, color?: string) => ({
    minWidth: 0,
    mr: collapsed ? 0 : 1.5,
    justifyContent: 'center',
    color: color ?? (active ? 'primary.main' : 'text.secondary'),
    opacity: color ? (active ? 1 : 0.65) : 1,
    transition: 'color 0.15s, opacity 0.15s',
  });

  const itemSx = (itemColor?: string) => ({
    borderRadius: 2,
    mx: 0.5,
    mb: 0.25,
    minHeight: 40,
    px: 1.5,
    justifyContent: collapsed ? 'center' : 'flex-start',
    '&.Mui-selected': { bgcolor: alpha(itemColor ?? theme.palette.primary.main, 0.1), color: itemColor ?? 'primary.main' },
    '&.Mui-selected:hover': { bgcolor: alpha(itemColor ?? theme.palette.primary.main, 0.15) },
  });

  return (
    <Box
      component="nav"
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Scrollable content area */}
      <Box
        ref={scrollContainerRef}
        sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1, display: 'flex', flexDirection: 'column' }}
      >
        {navigationItems.map((item) => {
          const active = isActive(item.key);
          const icon   = navItemIconMap[item.key];
          const color  = navItemColorMap[item.key];
          return (
            <Tooltip key={item.key} title={collapsed ? item.label : ''} placement="right" arrow
              disableHoverListener={!collapsed} disableFocusListener={!collapsed} disableTouchListener={!collapsed}
            >
              <ListItemButton
                selected={active}
                ref={active ? setActiveRef : undefined}
                onClick={() => navigate(item.key === 'home' ? '/' : `/${item.key}`)}
                sx={itemSx(color)}
              >
                {icon && <ListItemIcon sx={iconSx(active, color)}>{icon}</ListItemIcon>}
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontWeight: active ? 700 : 400, fontSize: '0.9rem', color: active ? (color ?? 'primary.main') : 'text.primary' }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          );
        })}

        {/* Nachrichten */}
        <Tooltip title={collapsed ? 'Nachrichten' : ''} placement="right" arrow
          disableHoverListener={!collapsed} disableFocusListener={!collapsed} disableTouchListener={!collapsed}
        >
          <ListItemButton onClick={openMessages} sx={itemSx(navItemColorMap['messages'])}>
            <ListItemIcon sx={iconSx(false, navItemColorMap['messages'])}>
              <Badge badgeContent={unreadMessageCount} color="error">
                <MessageIcon fontSize="small" />
              </Badge>
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Nachrichten" primaryTypographyProps={{ fontSize: '0.9rem' }} />}
          </ListItemButton>
        </Tooltip>

        {/* Trainer-Bereich */}
        {isCoach && (
          <>
            <Divider sx={{ my: 1 }} />
            {!collapsed && (
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ px: 2, py: 0.5, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.65rem', display: 'block' }}
              >
                Trainer
              </Typography>
            )}
            {trainerMenuItems.map((item) => {
              const active = isActive(item.key);
              const color  = navItemColorMap[item.key];
              return (
                <Tooltip key={item.key} title={collapsed ? item.label : ''} placement="right" arrow
                  disableHoverListener={!collapsed} disableFocusListener={!collapsed} disableTouchListener={!collapsed}
                >
                  <ListItemButton selected={active} ref={active ? setActiveRef : undefined} onClick={() => navigate(`/${item.key}`)} sx={itemSx(color)}>
                    <ListItemIcon sx={iconSx(active, color)}>
                      {React.cloneElement(item.icon as React.ReactElement<any>, { sx: { fontSize: '1.25rem', color: 'inherit' } })}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontWeight: active ? 700 : 400, fontSize: '0.9rem', color: active ? (color ?? 'primary.main') : 'text.primary' }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </>
        )}

        {/* Administrations-Bereich */}
        {isAdmin && (
          <>
            <Divider sx={{ my: 1 }} />
            {!collapsed && (
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ px: 2, py: 0.5, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.65rem', display: 'block' }}
              >
                Administration
              </Typography>
            )}
            {adminMenuSections.map((section) => (
              <Box key={section.section}>
                {!collapsed && (
                  <Typography variant="caption" color="text.disabled"
                    sx={{ px: 2, py: 0.25, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.62rem', display: 'block' }}
                  >
                    {section.section}
                  </Typography>
                )}
                {section.items.map((item) => {
                  const p      = item.page || item.href || '';
                  const active = pathname === `/${p}` || pathname.startsWith(`/${p}/`);
                  return (
                    <Tooltip key={item.label} title={collapsed ? item.label : ''} placement="right" arrow
                      disableHoverListener={!collapsed} disableFocusListener={!collapsed} disableTouchListener={!collapsed}
                    >
                      <ListItemButton
                        selected={active}
                        ref={active ? setActiveRef : undefined}
                        onClick={() => { if (item.page) navigate(`/${item.page}`); else if (item.href) navigate(item.href!); }}
                        sx={itemSx()}
                      >
                        <ListItemIcon sx={iconSx(active)}>
                          {React.cloneElement(item.icon as React.ReactElement<any>, { sx: { fontSize: '1.1rem', color: 'inherit' } })}
                        </ListItemIcon>
                        {!collapsed && (
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{ fontWeight: active ? 700 : 400, fontSize: '0.85rem', color: active ? 'primary.main' : 'text.primary' }}
                          />
                        )}
                      </ListItemButton>
                    </Tooltip>
                  );
                })}
              </Box>
            ))}
          </>
        )}

        {/* QR-Code teilen (am Ende der scrollbaren Liste) */}
        <Box sx={{ mt: 'auto', pt: 1 }}>
          <Divider sx={{ mb: 1 }} />
          <Tooltip title={collapsed ? 'QR-Code teilen' : ''} placement="right" arrow
            disableHoverListener={!collapsed} disableFocusListener={!collapsed} disableTouchListener={!collapsed}
          >
            <ListItemButton onClick={onOpenQRShare} sx={itemSx()}>
              <ListItemIcon sx={iconSx(false)}>
                <QrCode2Icon fontSize="small" />
              </ListItemIcon>
              {!collapsed && <ListItemText primary="QR-Code teilen" primaryTypographyProps={{ fontSize: '0.9rem' }} />}
            </ListItemButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Toggle-Button — sticky am unteren Rand, scrollt NICHT mit */}
      <Box
        sx={{
          flexShrink: 0,
          borderTop: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-end',
          px: 0.5,
          py: 0.5,
        }}
      >
        <Tooltip title={collapsed ? 'Menü aufklappen' : 'Menü einklappen'} placement="right">
          <IconButton
            size="small"
            onClick={onToggle}
            sx={{ color: 'text.secondary' }}
            aria-label={collapsed ? 'Menü aufklappen' : 'Menü einklappen'}
          >
            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
