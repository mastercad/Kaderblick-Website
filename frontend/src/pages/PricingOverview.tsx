import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { Link as RouterLink } from 'react-router-dom';
import DemoRequestModal from '../modals/DemoRequestModal';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import Seo from '../seo/Seo';
import '../styles/public-features.css';
import '../styles/public-home.css';

const pricingFeatures = [
  'Vereins- & Teamverwaltung',
  'Spielerverwaltung & Stammdaten',
  'Trainings- & Spielkalender',
  'Teilnahmen & Zusagemanagement',
  'Spielberichte & Statistiken',
  'Taktik-Editor & Formationen',
  'Nachrichtensystem & Kommunikation',
  'News & Vereinsmitteilungen',
  'Umfragen & Abstimmungen',
  'Videoanalyse (YouTube-Integration)',
  'Berichtswesen & Auswertungen',
  'DSGVO-konform · Deutsche Server',
];

const PricingOverview: React.FC = () => {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Preise – Kaderblick',
    url: 'https://kaderblick.de/preise',
    description: 'Kaderblick kostet 10 € pro Team und Monat – alle Funktionen inklusive, keine versteckten Kosten. Faire Preise für jeden Fußballverein.',
  };

  return (
    <Box className="public-features">
      <Seo
        title="Preise | Kaderblick – Vereinssoftware für Fußballvereine"
        description="Kaderblick kostet 10 € pro Team und Monat. Alle Funktionen inklusive, keine versteckten Kosten – faire Preise für jeden Fußballverein."
        canonicalPath="/preise"
        jsonLd={jsonLd}
      />

      <Box component="section" className="public-features-hero">
        <Box className="public-features-hero-overlay" />

        <Container maxWidth="xl" className="public-features-shell">
          <PublicSiteHeader onOpenDemo={() => setDemoModalOpen(true)} />
          <Box className="public-features-hero-shell">
            <Box className="public-features-hero-copy">
              <Typography className="public-features-kicker">
                Transparente Preise
              </Typography>
              <Typography component="h1" className="public-features-title">
                Ein Plan.
                <span>Alles inklusive.</span>
              </Typography>
              <Typography className="public-features-intro">
                Faire Preise für jeden Verein – weil guter Fußball keine Budgetfrage sein sollte.
                Kaderblick bietet alle Funktionen in einem einzigen Plan, ohne Feature-Gating und ohne
                versteckte Kosten. 10 € pro Team und Monat, das war's.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="public-features-action-row">
                <Button
                  onClick={() => setDemoModalOpen(true)}
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className="public-features-primary-button"
                >
                  Demo anfragen
                </Button>
                <Button
                  component="a"
                  href="#preise-details"
                  variant="outlined"
                  className="public-features-secondary-button"
                >
                  Was ist enthalten?
                </Button>
              </Stack>

              <Box className="public-features-stat-grid">
                <Box className="public-features-stat-card">
                  <Typography className="public-features-stat-value">10 €</Typography>
                  <Typography className="public-features-stat-label">pro Team und Monat, alle Funktionen inklusive</Typography>
                </Box>
                <Box className="public-features-stat-card">
                  <Typography className="public-features-stat-value">Keine</Typography>
                  <Typography className="public-features-stat-label">versteckten Kosten, Zusatzpakete oder Feature-Sperren</Typography>
                </Box>
                <Box className="public-features-stat-card">
                  <Typography className="public-features-stat-value">Demo</Typography>
                  <Typography className="public-features-stat-label">mit echten Demodaten testen – isoliert, ohne Registrierung</Typography>
                </Box>
              </Box>
            </Box>

            <Box className="public-features-hero-panel">
              <Typography className="public-features-panel-kicker">Unser Ansatz</Typography>
              <Typography className="public-features-panel-title">Warum ein einziger Plan das Richtige ist</Typography>
              <Box className="public-features-panel-list">
                {[
                  'Kein künstliches Feature-Gating – alle Vereine erhalten denselben Funktionsumfang.',
                  'Keine komplizierten Tiers, die kleine Vereine benachteiligen.',
                  'Wer mehr Teams verwaltet, zahlt einfach pro Team – fair und nachvollziehbar.',
                ].map((point) => (
                  <Box key={point} className="public-features-panel-item">
                    <Box className="public-features-panel-icon">
                      <CheckCircleOutlineRoundedIcon />
                    </Box>
                    <Box>
                      <Typography className="public-features-panel-item-text">{point}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" className="public-features-shell public-features-main">
        <Box component="section" id="preise-details" className="public-features-section">
          <Box className="public-features-section-head">
            <Box>
              <Typography className="public-features-section-kicker">Leistungsumfang</Typography>
              <Typography component="h2" className="public-features-section-title">
                Was im Plan enthalten ist
              </Typography>
            </Box>
            <Typography className="public-features-section-text">
              Alle Funktionen. Für alle Teams. Ohne Abstriche. Die folgende Liste zeigt, was mit
              jedem Team-Zugang vollständig nutzbar ist – vom ersten Tag an.
            </Typography>
          </Box>

          <Box className="public-home-pricing-section" sx={{ background: 'transparent', padding: '0 0 2rem' }}>
            <Box className="public-home-pricing-inner">
              <Box className="public-home-pricing-card-wrap">
                <Box className="public-home-pricing-card">
                  <Typography className="public-home-pricing-badge">Beta · Preise unverbindlich</Typography>
                  <Typography className="public-home-pricing-plan-name">Pro Team</Typography>
                  <Box className="public-home-pricing-price-row">
                    <Typography className="public-home-pricing-amount">10 €</Typography>
                    <Typography className="public-home-pricing-period">/ Monat pro Team</Typography>
                  </Box>
                  <Typography className="public-home-pricing-tagline">
                    Alle Funktionen. Keine versteckten Kosten.
                  </Typography>
                  <Box className="public-home-pricing-features">
                    {pricingFeatures.map((feature) => (
                      <Box key={feature} className="public-home-pricing-feature-row">
                        <CheckCircleOutlineRoundedIcon />
                        <Typography>{feature}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardRoundedIcon />}
                    className="public-home-demo-button public-home-pricing-cta"
                    onClick={() => setDemoModalOpen(true)}
                  >
                    Demo anfragen
                  </Button>
                </Box>

                <Box className="public-home-pricing-note">
                  <Typography>
                    <strong>Demo verfügbar:</strong> Teste Kaderblick mit vorausgefüllten Demodaten – ohne Registrierung, ohne Einschränkungen. Deine echten Vereinsdaten bleiben dabei vollständig getrennt.
                  </Typography>
                </Box>
              </Box>

              <Typography className="public-home-pricing-disclaimer">
                * Preisangaben sind unverbindlich. Kaderblick befindet sich derzeit in der Testphase.
                Die finalen Konditionen werden rechtzeitig vor dem offiziellen Start bekanntgegeben.
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box component="section" className="public-features-section">
          <Box className="public-features-spotlight">
            <Box className="public-features-spotlight-copy">
              <Typography className="public-features-section-kicker">Hintergrund</Typography>
              <Typography component="h2" className="public-features-spotlight-title">
                Warum 10 € – und nicht mehr, nicht weniger
              </Typography>
              <Typography className="public-features-spotlight-text">
                Gute Vereinssoftware scheitert oft nicht an der Qualität, sondern am Preis.
                Besonders kleinere Vereine, Jugendteams und Amateurmannschaften haben kein Budget
                für teure Lizenzen. Gleichzeitig kostet Infrastruktur Geld – Server, Wartung,
                Weiterentwicklung. Der Preis von 10 € pro Team und Monat ist bewusst so gewählt,
                dass er für jeden tragbar ist und gleichzeitig einen nachhaltigen Betrieb ermöglicht.
              </Typography>
              <Box className="public-features-spotlight-list">
                <Box className="public-features-spotlight-item">
                  <CheckCircleOutlineRoundedIcon />
                  <Typography className="public-features-card-text">Kein Freemium-Modell – alle Teams erhalten denselben vollen Funktionsumfang.</Typography>
                </Box>
                <Box className="public-features-spotlight-item">
                  <CheckCircleOutlineRoundedIcon />
                  <Typography className="public-features-card-text">Skalierung über die Teamanzahl, nicht über Feature-Locks.</Typography>
                </Box>
                <Box className="public-features-spotlight-item">
                  <CheckCircleOutlineRoundedIcon />
                  <Typography className="public-features-card-text">Transparenz statt Lockangeboten – der Preis gilt dauerhaft pro Team.</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>

      <DemoRequestModal open={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
    </Box>
  );
};

export default PricingOverview;
