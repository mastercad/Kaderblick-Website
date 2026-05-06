import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link as RouterLink } from 'react-router-dom';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import Seo from '../seo/Seo';
import { faqEntries } from '../content/marketingContent';
import { DOCS_URL } from '../seo/siteConfig';
import '../styles/public-features.css';

const Faq: React.FC = () => {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };

  return (
    <Box className="public-features">
      <Seo
        title="FAQ zur Vereinssoftware Kaderblick"
        description="Antworten auf häufige Fragen zu Kaderblick: Zielgruppe, Einsatz im Amateurfußball, PWA, Vereinsorganisation und digitale Kommunikation im Verein."
        canonicalPath="/faq"
        jsonLd={faqJsonLd}
      />

      <Box component="section" className="public-features-hero">
        <Box className="public-features-hero-overlay" />

        <Container maxWidth="xl" className="public-features-shell">
          <PublicSiteHeader />
          <Box className="public-features-hero-shell">
            <Box className="public-features-hero-copy">
              <Typography className="public-features-kicker">Häufige Fragen</Typography>
              <Typography component="h1" className="public-features-title">
                FAQ zu
                <span>Kaderblick</span>
              </Typography>
              <Typography className="public-features-intro">
                Antworten auf häufige Fragen rund um Nutzung, Zielgruppen und den Einsatz von Kaderblick im Vereinsalltag.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="public-features-action-row">
                <Button
                  component="a"
                  href="#faq-list"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className="public-features-primary-button"
                >
                  Fragen ansehen
                </Button>
                <Button
                  component="a"
                  href={DOCS_URL}
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                  className="public-features-secondary-button"
                >
                  Zur Dokumentation
                </Button>
              </Stack>
            </Box>

            <Box className="public-features-hero-panel">
              <Typography className="public-features-panel-kicker">Kurz eingeordnet</Typography>
              <Typography className="public-features-panel-title">Die häufigsten Einstiegsthemen</Typography>
              <Box className="public-features-panel-list">
                {faqEntries.slice(0, 3).map((entry) => (
                  <Box key={entry.question} className="public-features-panel-item">
                    <Box className="public-features-panel-icon">
                      <ArrowForwardRoundedIcon />
                    </Box>
                    <Box>
                      <Typography className="public-features-panel-item-title">{entry.question}</Typography>
                      <Typography className="public-features-panel-item-text">{entry.answer}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" className="public-features-shell public-features-main public-features-main-tight">
        <Box className="public-features-content-shell">
          <Box id="faq-list" className="public-features-faq-list">
            {faqEntries.map((entry) => (
              <Accordion key={entry.question} disableGutters className="public-features-faq-item">
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h2" className="public-features-faq-question">
                    {entry.question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography className="public-features-faq-answer">
                    {entry.answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>

          <Stack spacing={2.2}>
            <Box className="public-features-docs-card">
              <Box className="public-features-docs-body">
                <Typography className="public-features-card-kicker">Weiterlesen</Typography>
                <Typography component="h2" className="public-features-docs-title">
                  Mehr Details in der Dokumentation
                </Typography>
                <Typography className="public-features-docs-text">
                  Wenn eine Antwort nur die Richtung vorgibt, findest du die fachliche Tiefe in der Dokumentation.
                </Typography>
                <Stack spacing={1.1} sx={{ mt: 2 }}>
                  <Button
                    component="a"
                    href={DOCS_URL}
                    target="_blank"
                    rel="noreferrer"
                    variant="outlined"
                    endIcon={<ArrowOutwardRoundedIcon />}
                    className="public-features-doc-link"
                  >
                    Gesamte Dokumentation öffnen
                  </Button>
                </Stack>
              </Box>
            </Box>

            <Box className="public-features-cta-panel">
              <Box className="public-features-cta-body">
                <Typography className="public-features-card-kicker" sx={{ color: 'rgba(255,255,255,0.82) !important' }}>
                  Noch offen?
                </Typography>
                <Typography component="h2" className="public-features-cta-title">
                  Offene Fragen direkt klären
                </Typography>
                <Typography className="public-features-cta-text">
                  Wenn deine Frage nicht dabei war, kannst du den Einsatz von Kaderblick direkt über die Kontaktseite einordnen lassen.
                </Typography>
                <Button
                  component={RouterLink}
                  to="/kontakt"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className="public-features-ghost-button"
                  sx={{ mt: 2.1 }}
                >
                  Kontakt aufnehmen
                </Button>
              </Box>
            </Box>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default Faq;