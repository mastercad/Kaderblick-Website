import React from 'react';
import { Box, Container, Stack, Typography } from '@mui/material';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import Seo from '../seo/Seo';
import '../styles/public-features.css';

const Privacy: React.FC = () => (
  <Box className="public-features">
    <Seo
      title="Datenschutz | Kaderblick"
      description="Datenschutzhinweise von Kaderblick zu Verarbeitung, Google-SSO, Cookies und den Rechten betroffener Personen."
      canonicalPath="/privacy"
    />

    <Box component="section" className="public-features-hero">
      <Box className="public-features-hero-overlay" />

      <Container maxWidth="xl" className="public-features-shell">
        <PublicSiteHeader />
        <Box className="public-features-hero-shell">
          <Box className="public-features-hero-copy">
            <Typography className="public-features-kicker">Datenschutz</Typography>
            <Typography component="h1" className="public-features-title">
              Datenschutzerklärung
            </Typography>
            <Typography className="public-features-intro">
              Der Schutz persönlicher Daten ist ein zentrales Thema. Hier findest du die maßgeblichen Hinweise zur Verarbeitung auf der öffentlichen Kaderblick-Webseite.
            </Typography>
          </Box>

          <Box className="public-features-hero-panel">
            <Typography className="public-features-panel-kicker">Grundlage</Typography>
            <Typography className="public-features-panel-title">Verarbeitung nach gesetzlichen Bestimmungen</Typography>
            <Typography className="public-features-panel-item-text">
              Die Verarbeitung erfolgt auf Grundlage der einschlägigen Datenschutzvorschriften, insbesondere DSGVO und weiterer anwendbarer Regelungen.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>

    <Container maxWidth="xl" className="public-features-shell public-features-main public-features-main-tight">
      <Box className="public-features-content-shell">
        <Box className="public-features-legal-grid">
          <Box className="public-features-summary-card public-features-legal-section">
            <h2>1. Verantwortlicher</h2>
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Webseite ist:
              <br />
              <strong>Andreas Kempe</strong>
              <br />
              E-Mail: <a href="mailto:andreas.kempe@kaderblick.de">andreas.kempe@kaderblick.de</a>
            </p>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>2. Erhebung und Verarbeitung personenbezogener Daten</h2>
            <ul>
              <li>Beim Besuch der Webseite, etwa Server-Logs, IP-Adresse, Browser und Uhrzeit</li>
              <li>Bei Registrierung und Nutzung, etwa Name, E-Mail, Profilangaben und Teamzugehörigkeit</li>
              <li>Bei Anmeldung über Google SSO, etwa Google-ID, Name, E-Mail und optionales Profilbild</li>
              <li>Bei Feedback-Formularen und Kontaktaufnahmen</li>
            </ul>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>3. Google Single Sign-On (SSO)</h2>
            <p>Wir bieten die Anmeldung über Google SSO an. Dabei wirst du zu Google weitergeleitet, um dich mit deinem Google-Konto anzumelden. Wir erhalten von Google insbesondere Namen, E-Mail-Adresse, Google-User-ID und optional ein Profilbild.</p>
            <p>Weitere Informationen zur Datenverarbeitung durch Google findest du in der <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google-Datenschutzerklärung</a>.</p>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>4. Zweck der Datenverarbeitung</h2>
            <ul>
              <li>Organisation und Kommunikation innerhalb von Sportteams, zum Beispiel Fußballmannschaften</li>
              <li>Bereitstellung und Verbesserung der Webseite</li>
              <li>Authentifizierung und Zugangskontrolle</li>
              <li>Feedback-Auswertung</li>
              <li>Statistische Analysen</li>
            </ul>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>5. Weitergabe von Daten</h2>
            <p>Deine Daten werden nicht an Dritte weitergegeben, außer es besteht eine gesetzliche Verpflichtung oder dies ist für die technische Bereitstellung der Plattform erforderlich.</p>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>6. Cookies und lokale Speicherung</h2>
            <p>Wir verwenden Cookies und Local Storage, um die Funktionalität der Seite zu gewährleisten, zum Beispiel für Login-Status oder Theme-Auswahl. Du kannst dies in deinem Browser einschränken oder deaktivieren.</p>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>7. Deine Rechte</h2>
            <ul>
              <li>Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung</li>
              <li>Datenübertragbarkeit</li>
              <li>Widerruf einer Einwilligung</li>
              <li>Beschwerde bei der Datenschutzbehörde</li>
            </ul>
            <p>Bei Fragen kannst du dich an <a href="mailto:andreas.kempe@kaderblick.de">andreas.kempe@kaderblick.de</a> wenden.</p>
          </Box>

          <Box className="public-features-summary-card public-features-legal-section">
            <h2>8. Änderungen</h2>
            <p>Wir behalten uns vor, diese Datenschutzerklärung zu aktualisieren. Die jeweils aktuelle Version findest du auf dieser Seite.</p>
          </Box>
        </Box>

        <Stack spacing={2.2}>
          <Box className="public-features-docs-card">
            <Box className="public-features-docs-body">
              <Typography className="public-features-card-kicker">Kontakt</Typography>
              <Typography component="h2" className="public-features-docs-title">
                Datenschutzanfragen
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

export default Privacy;
