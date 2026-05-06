import React, { useState } from 'react';
import { Box, Button, Divider, Drawer, IconButton, Link, List, ListItem, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/public-home.css';

interface PublicSiteHeaderProps {
  onOpenAuth?: () => void;
  onOpenDemo?: () => void;
}

const defaultOpenAuth = () => {
  window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { initialTab: 'login' } }));
};

export default function PublicSiteHeader({ onOpenAuth = defaultOpenAuth, onOpenDemo }: PublicSiteHeaderProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleOpenDemo = onOpenDemo ?? (() => {
    window.location.href = isHome ? '#cta' : '/#cta';
  });

  if (isAuthenticated) {
    return null;
  }

  const navItems = [
    { label: 'Funktionen', href: '/funktionen', active: location.pathname.startsWith('/funktionen') },
    { label: 'Vorteile', href: '/vorteile', active: location.pathname === '/vorteile' },
    { label: 'Preise', href: '/preise', active: location.pathname === '/preise' },
    { label: 'Über uns', href: '/ueber-uns', active: location.pathname === '/ueber-uns' },
    { label: 'Kontakt', href: '/kontakt', active: location.pathname === '/kontakt' },
  ];

  return (
    <Box component="header" className="public-home-header">
      <Link component={RouterLink} to="/" underline="none" className="public-home-logo-link">
        <Box className="public-home-logo-mark" aria-hidden="true">
          <span />
          <span />
        </Box>
        <Typography className="public-home-logo-text" component="span">
          <span className="public-home-logo-k">K</span>
          <span className="public-home-logo-aderblick">ADERBLICK</span>
        </Typography>
      </Link>

      <Stack component="nav" direction="row" spacing={0.5} className="public-home-nav">
        {navItems.map((item) => (
          <Button
            key={item.label}
            className={`public-home-nav-link${item.active ? ' public-home-nav-link-active' : ''}`}
            component="a"
            href={item.href}
          >
            {item.label}
          </Button>
        ))}
      </Stack>

      <Stack direction="row" spacing={1.25} className="public-home-header-actions">
        <Button
          variant="outlined"
          startIcon={<LoginOutlinedIcon />}
          className="public-home-login-button"
          onClick={onOpenAuth}
        >
          Login
        </Button>
        <Button
          variant="contained"
          startIcon={<CalendarMonthOutlinedIcon />}
          className="public-home-demo-button"
          onClick={handleOpenDemo}
        >
          Demo anfragen
        </Button>
      </Stack>

      <IconButton
        className="public-home-hamburger"
        aria-label="Menü öffnen"
        onClick={() => setDrawerOpen(true)}
        sx={{
          color: '#ffffff',
          borderRadius: '0.4rem',
          '&:focus-visible': { outline: '2px solid #33b448', outlineOffset: '2px' },
          '&.MuiIconButton-root': { borderRadius: '0.4rem' },
        }}
      >
        <MenuRoundedIcon />
      </IconButton>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          className: 'public-home-mobile-drawer',
          sx: {
            bgcolor: '#0b0e0c',
            color: '#ffffff',
          },
        }}
      >
        <Box className="public-home-mobile-drawer-header">
          <Link component={RouterLink} to="/" underline="none" className="public-home-logo-link" onClick={() => setDrawerOpen(false)}>
            <Box className="public-home-logo-mark" aria-hidden="true">
              <span />
              <span />
            </Box>
            <Typography className="public-home-logo-text" component="span">
              <span className="public-home-logo-k">K</span>
              <span className="public-home-logo-aderblick">ADERBLICK</span>
            </Typography>
          </Link>
          <IconButton
            aria-label="Menü schließen"
            onClick={() => setDrawerOpen(false)}
            className="public-home-mobile-drawer-close"
            sx={{ color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        <Divider className="public-home-mobile-drawer-divider" />

        <List className="public-home-mobile-drawer-nav" component="nav">
          {navItems.map((item) => (
            <ListItem key={item.label} disablePadding>
              <ListItemButton
                component="a"
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={`public-home-mobile-nav-item${item.active ? ' public-home-mobile-nav-item-active' : ''}`}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box className="public-home-mobile-drawer-actions">
          <Button
            variant="outlined"
            startIcon={<LoginOutlinedIcon />}
            fullWidth
            onClick={() => { setDrawerOpen(false); onOpenAuth(); }}
            sx={{
              color: '#ffffff',
              borderColor: 'rgba(255,255,255,0.4)',
              fontFamily: 'var(--public-home-font-family)',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '0.5rem',
              '&:hover': { borderColor: '#ffffff', background: 'rgba(255,255,255,0.06)' },
            }}
          >
            Login
          </Button>
          <Button
            variant="contained"
            startIcon={<CalendarMonthOutlinedIcon />}
            className="public-home-demo-button"
            fullWidth
            onClick={() => { setDrawerOpen(false); handleOpenDemo(); }}
          >
            Demo anfragen
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
}