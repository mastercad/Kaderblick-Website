import React from 'react';
import {
  Box,
  Container,
  LinearProgress,
  Typography,
} from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import '../../styles/public-home.css';

const heroHighlights = [
  {
    title: 'Einfach zu bedienen',
    text: 'Intuitiv & schnell startklar',
  },
  {
    title: 'Alles an einem Ort',
    text: 'Organisation leicht gemacht',
  },
  {
    title: 'Für alle Vereinsgrößen',
    text: 'Von Jugend bis Profis',
  },
];

interface PublicLoadingScreenProps {
  message?: string;
}

export default function PublicLoadingScreen({ message = 'Inhalte werden geladen' }: PublicLoadingScreenProps) {
  return (
    <Box
      className="public-home"
      sx={{
        minHeight: { xs: 'max(32rem, 100dvh - var(--app-header-height, 0px))', md: 'max(36rem, 100dvh - var(--app-header-height, 0px))' },
        background: '#0c0e0d',
      }}
    >
      <Box
        component="section"
        className="public-home-hero"
        sx={{
          minHeight: 'inherit',
        }}
      >
        <Box className="public-home-hero-overlay" sx={{ top: 0 }} />

        <Container maxWidth="xl" className="public-home-shell" sx={{ position: 'relative', zIndex: 2 }}>
          <Box
            className="public-home-header"
            sx={{
              gridTemplateColumns: 'auto 1fr auto',
              px: { xs: 0.5, sm: 1.25 },
            }}
          >
            <Box className="public-home-logo-link" aria-label="Kaderblick lädt Inhalte">
              <Box
                component="img"
                src="/images/kaderblick_website_appicon.svg"
                alt=""
                aria-hidden="true"
                className="public-home-logo-icon"
              />
              <Typography className="public-home-logo-text" component="span">
                <span className="public-home-logo-k">K</span>
                <span className="public-home-logo-aderblick">ADERBLICK</span>
              </Typography>
            </Box>

            <Box sx={{ display: { xs: 'none', md: 'block' } }} />

            <Typography
              component="span"
              sx={{
                justifySelf: 'end',
                px: 1.4,
                py: 0.7,
                borderRadius: '999px',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'rgba(255, 255, 255, 0.92)',
                fontSize: '0.88rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              {message}
            </Typography>
          </Box>

          <Box
            className="public-home-hero-content"
            sx={{
              minHeight: { xs: 'calc(100dvh - 4.5rem)', md: 'calc(100dvh - 4.5rem)' },
              py: { xs: 5, md: 7 },
            }}
          >
            <Box className="public-home-hero-copy">
              <Typography component="h1" className="public-home-hero-title">
                Die Software für
                <span>Fußballvereine</span>
              </Typography>

              <Typography className="public-home-hero-text">
                Kaderblick hilft Vereinen, Trainern, Eltern und Jugendleitungen,
                das Vereinsleben effizient zu organisieren. Einen Moment bitte,
                die Inhalte werden gerade vorbereitet.
              </Typography>

              <Box sx={{ width: 'min(100%, 26rem)', mt: 3.25 }} aria-live="polite">
                <Typography
                  sx={{
                    mb: 1.1,
                    color: 'rgba(255, 255, 255, 0.74)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {message}
                </Typography>
                <LinearProgress
                  color="inherit"
                  sx={{
                    height: 6,
                    borderRadius: '999px',
                    overflow: 'hidden',
                    backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    color: '#33b448',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: '999px',
                      background: 'linear-gradient(90deg, #38bc4f 0%, #22a53b 100%)',
                    },
                  }}
                />
              </Box>

              <Box className="public-home-highlight-row" sx={{ mt: 3.25 }}>
                {heroHighlights.map((highlight) => (
                  <Box key={highlight.title} className="public-home-highlight-item">
                    <Box className="public-home-highlight-icon">
                      <CheckCircleOutlineRoundedIcon />
                    </Box>
                    <Box>
                      <Typography className="public-home-highlight-title">{highlight.title}</Typography>
                      <Typography className="public-home-highlight-text">{highlight.text}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}