import React from 'react';
import { Box, Container, Link, Typography, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import CookieSettingsButton from './CookieSettingsButton';
import { useAuth } from '../context/AuthContext';

const Footer: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const { user } = useAuth();
  const isHome = location.pathname === '/' || location.pathname === '';
  const [buildNumber, setBuildNumber] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/buildinfo.json')
      .then(res => res.ok ? res.json() : null)
      .then(data => setBuildNumber(data?.build || null))
      .catch(() => setBuildNumber(null));
  }, []);

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        py: 1.5,
        pb: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        background: isHome
          ? 'transparent'
          : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
        backgroundColor: isHome ? 'transparent' : undefined,
        color: isHome
          ? '#fff'
          : theme.palette.primary.contrastText,
        '& *': isHome ? { color: '#fff' } : {},
        fontSize: '0.95em',
      }}
    >
      <Container maxWidth="md" 
        sx={{ 
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: { xs: 0.5, sm: 2 }
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            &copy; {new Date().getFullYear()} Kaderblick
            {buildNumber && (
              <Box component="span" style={{ color: '#CCCCCC', fontSize: '0.85em', marginLeft: 8 }} title={`Build: ${buildNumber}`}>
                v{buildNumber}
              </Box>
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link component={RouterLink} to="/kontakt" color="inherit" underline="hover">
            Kontakt
          </Link>
          <Link component={RouterLink} to="/imprint" color="inherit" underline="hover">
            Impressum
          </Link>
          <Link component={RouterLink} to="/privacy" color="inherit" underline="hover">
            Datenschutz
          </Link>
          <Link component={RouterLink} to="https://docs.kaderblick.de" color="inherit" underline="hover">
            Dokumentation
          </Link>
          {!user && <CookieSettingsButton />}
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
