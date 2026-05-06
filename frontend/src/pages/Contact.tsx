import React from 'react';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import Seo from '../seo/Seo';
import '../styles/public-features.css';

const ContactPage: React.FC = () => {
  const contactJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kaderblick',
    url: 'https://kaderblick.de/',
    email: 'andreas.kempe@kaderblick.de',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'andreas.kempe@kaderblick.de',
        availableLanguage: ['de'],
      },
    ],
  };

  const openContactModal = () => {
    window.dispatchEvent(new CustomEvent('openContactModal'));
  };

  return (
    <Box className="public-features">
      <Seo
        title="Kontakt zu Kaderblick"
        description="Kontaktseite für Kaderblick. Austausch zu Vereinsorganisation, Trainer-Workflows, Produktfragen und Einsatz im Fußballverein."
        canonicalPath="/kontakt"
        jsonLd={contactJsonLd}
      />

      <Box component="section" className="public-features-hero">
        <Box className="public-features-hero-overlay" />

        <Container maxWidth="xl" className="public-features-shell">
          <PublicSiteHeader />
          <Box className="public-features-hero-shell">
            <Box className="public-features-hero-copy">
              <Typography className="public-features-kicker">Kontakt</Typography>
              <Typography component="h1" className="public-features-title">
                Austausch zu
                <span>Kaderblick</span>
              </Typography>
              <Typography className="public-features-intro">
                Wenn du Kaderblick für deinen Verein, dein Trainerteam oder eure organisatorischen Prozesse einordnen möchtest, ist diese Seite der öffentliche Kontaktpunkt der Plattform.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="public-features-action-row">
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className="public-features-primary-button"
                  onClick={openContactModal}
                >
                  Nachricht senden
                </Button>
                <Button
                  variant="outlined"
                  href="mailto:andreas.kempe@kaderblick.de"
                  className="public-features-secondary-button"
                >
                  E-Mail schreiben
                </Button>
              </Stack>
            </Box>

            <Box className="public-features-hero-panel">
              <Typography className="public-features-panel-kicker">Direkter Draht</Typography>
              <Typography className="public-features-panel-title">So erreichst du Kaderblick</Typography>
              <Box className="public-features-panel-list">
                <Box className="public-features-panel-item">
                  <Box className="public-features-panel-icon">
                    <EmailOutlinedIcon />
                  </Box>
                  <Box>
                    <Typography className="public-features-panel-item-title">Andreas Kempe</Typography>
                    <Typography className="public-features-panel-item-text">andreas.kempe@kaderblick.de</Typography>
                  </Box>
                </Box>
                <Box className="public-features-panel-item">
                  <Box className="public-features-panel-icon">
                    <HandshakeOutlinedIcon />
                  </Box>
                  <Box>
                    <Typography className="public-features-panel-item-title">Typische Themen</Typography>
                    <Typography className="public-features-panel-item-text">Einführung, Einordnung, Rollenperspektiven und produktnahe Fragen.</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" className="public-features-shell public-features-main public-features-main-tight">
        <Box className="public-features-content-shell">
          <Stack spacing={2.2}>
            <Box className="public-features-summary-card">
              <Box className="public-features-summary-body">
                <Typography className="public-features-card-kicker">Kontaktpunkt</Typography>
                <Typography component="h2" className="public-features-summary-title">
                  Direkter Kontakt für Produkt- und Einsatzfragen
                </Typography>
                <Typography className="public-features-summary-text">
                  Hier geht es nicht um Support-Floskeln, sondern um eine klare Einordnung: Passt Kaderblick zu eurem Verein, euren Prozessen und eurer Rolle im Fußballalltag?
                </Typography>
              </Box>
            </Box>

            <Box className="public-features-docs-card">
              <Box className="public-features-docs-body">
                <Typography className="public-features-card-kicker">Typische Anliegen</Typography>
                <Box className="public-features-contact-list">
                  <Box className="public-features-contact-item">
                    <Typography className="public-features-contact-item-title">Digitale Vereinsorganisation</Typography>
                    <Typography className="public-features-contact-item-text">Training, Spiele, Kommunikation und Koordination sauber in einer Plattform abbilden.</Typography>
                  </Box>
                  <Box className="public-features-contact-item">
                    <Typography className="public-features-contact-item-title">Fachliche Produktfragen</Typography>
                    <Typography className="public-features-contact-item-text">Fragen zu Formationen, Spielanalyse, News, Berichten und der konkreten Einordnung im Vereinsalltag.</Typography>
                  </Box>
                  <Box className="public-features-contact-item">
                    <Typography className="public-features-contact-item-title">Rollen und Zielgruppen</Typography>
                    <Typography className="public-features-contact-item-text">Einordnung der Plattform für Trainer, Eltern, Jugendleitung und Administration.</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Stack>

          <Stack spacing={2.2}>
            <Box className="public-features-docs-card">
              <Box className="public-features-docs-body">
                <Box className="public-features-doc-icon">
                  <ForumOutlinedIcon />
                </Box>
                <Typography className="public-features-card-kicker">Kontaktwege</Typography>
                <Typography component="h2" className="public-features-docs-title">
                  Schnellster Einstieg in ein Gespräch
                </Typography>
                <Typography className="public-features-docs-text">
                  Du kannst direkt eine Nachricht senden oder klassisch per E-Mail schreiben.
                </Typography>
                <Stack spacing={1.1} sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={openContactModal}
                    endIcon={<ArrowForwardRoundedIcon />}
                    className="public-features-doc-link"
                  >
                    Nachricht senden
                  </Button>
                  <Button
                    component="a"
                    href="mailto:andreas.kempe@kaderblick.de"
                    variant="outlined"
                    endIcon={<ArrowOutwardRoundedIcon />}
                    className="public-features-doc-link"
                  >
                    andreas.kempe@kaderblick.de
                  </Button>
                </Stack>
              </Box>
            </Box>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default ContactPage;