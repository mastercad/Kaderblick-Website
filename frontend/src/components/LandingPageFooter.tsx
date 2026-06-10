import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Container, Link, Stack, Typography, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import CookieSettingsButton from './CookieSettingsButton';
import { useAuth } from '../context/AuthContext';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import DemoRequestModal from '../modals/DemoRequestModal';

const LandingPageFooter: React.FC = () => {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
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
    <Box component="footer" id="cta" className="public-home-proof-section">
      <Container maxWidth="lg" className="public-home-proof-grid">
        <Box className="public-home-proof-copy">
          <Box className="public-home-proof-icon-wrap">
            <CalendarMonthOutlinedIcon />
          </Box>
          <Box>
            <Typography className="public-home-proof-title">
              Bereit, deinen Verein auf das nächste Level zu bringen?
            </Typography>
            {/*
            <Typography className="public-home-proof-text">
              Über 1.000 Vereine vertrauen bereits auf Kaderblick.
            </Typography>
            */}
            <Stack direction="row" spacing={2.5} className="public-home-proof-legal">
              <Link component={RouterLink} to="/kontakt" className="public-home-proof-link" underline="none">
                Kontakt
              </Link>
              <Link component={RouterLink} to="/imprint" className="public-home-proof-link" underline="none">
                Impressum
              </Link>
              <Link component={RouterLink} to="/privacy" className="public-home-proof-link" underline="none">
                Datenschutz
              </Link>
              {!user && <CookieSettingsButton sx={{color: 'white'}}/>}
            </Stack>
          </Box>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} className="public-home-proof-actions">
          <Button
            variant="contained"
            endIcon={<ArrowOutwardRoundedIcon />}
            className="public-home-cta-button-light"
            onClick={() => setDemoModalOpen(true)}
          >
            Demo anfragen
          </Button>
          <Button
            component={RouterLink}
            to="/funktionen"
            variant="outlined"
            endIcon={<ArrowOutwardRoundedIcon />}
            className="public-home-cta-button-ghost"
          >
            Mehr erfahren
          </Button>
        </Stack>
      </Container>

      <DemoRequestModal open={demoModalOpen} onClose={() => setDemoModalOpen(false)} />

    </Box>
  );
};

export default LandingPageFooter;
