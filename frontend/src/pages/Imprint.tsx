import React from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import Seo from '../seo/Seo';
import '../styles/public-features.css';

const Imprint: React.FC = () => (
  <Box className="public-features">
    <Seo
      title="Impressum | Kaderblick"
      description="Impressum von Kaderblick mit Anbieterangaben, Kontaktinformationen und rechtlichen Hinweisen."
      canonicalPath="/imprint"
    />

    <Box component="section" className="public-features-hero">
      <Box className="public-features-hero-overlay" />

      <Container maxWidth="xl" className="public-features-shell">
        <PublicSiteHeader />
        <Box className="public-features-hero-shell">
          <Box className="public-features-hero-copy">
            <Typography className="public-features-kicker">Rechtliches</Typography>
            <Typography component="h1" className="public-features-title">
              Impressum
            </Typography>
            <Typography className="public-features-intro">
              Anbieterangaben, Kontaktinformationen und rechtliche Hinweise für die öffentliche Präsenz von Kaderblick.
            </Typography>
          </Box>

          <Box className="public-features-hero-panel">
            <Typography className="public-features-panel-kicker">Anbieter</Typography>
            <Typography className="public-features-panel-title">Andreas Kempe</Typography>
            <Typography className="public-features-panel-item-text">
              Glück-Auf-Straße 11c
              <br />
              01705 Freital
              <br />
              Deutschland
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>

    <Container maxWidth="xl" className="public-features-shell public-features-main public-features-main-tight">
      <Box className="public-features-content-shell">
        <Box className="public-features-legal-grid">
          <Box className="public-features-summary-card public-features-legal-section">
            <h2>Angaben gemäß § 5 TMG</h2>
            <p>
              Andreas Kempe
              <br />
              Glück-Auf-Straße 11c
              <br />
              01705 Freital
              <br />
              Deutschland
            </p>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
            <p>
              Andreas Kempe
              <br />
              Glück-Auf-Straße 11c
              <br />
              01705 Freital
            </p>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>Haftungsausschluss</h2>
            <p>Die Inhalte dieser Webseite wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden.</p>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>Haftung für Links</h2>
            <p>Unsere Webseite enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>Urheberrecht</h2>
            <p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Beiträge Dritter sind als solche gekennzeichnet.</p>
          </Box>
        </Box>

        <Stack spacing={2.2}>
          <Box className="public-features-docs-card">
            <Box className="public-features-docs-body">
              <Typography className="public-features-card-kicker">Kontakt</Typography>
              <Typography component="h2" className="public-features-docs-title">
                Direkter Kontakt
              </Typography>
              <Typography className="public-features-docs-text">
                E-Mail: <a href="mailto:andreas.kempe@kaderblick.de">andreas.kempe@kaderblick.de</a>
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Box>
    </Container>
  </Box>
);

export default Imprint;
