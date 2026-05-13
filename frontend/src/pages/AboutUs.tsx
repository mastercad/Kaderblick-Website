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
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { Link as RouterLink } from 'react-router-dom';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import Seo from '../seo/Seo';
import '../styles/public-features.css';

const AboutUs: React.FC = () => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'Über Kaderblick',
    url: 'https://kaderblick.de/ueber-uns',
    description:
      'Kaderblick entstand aus echten Problemen im Amateurfußball und wuchs zu einer vollständigen Organisations- und Auswertungsplattform für Fußballvereine.',
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://kaderblick.de/' },
      { '@type': 'ListItem', position: 2, name: 'Über uns', item: 'https://kaderblick.de/ueber-uns' },
    ],
  };

  return (
    <Box className="public-features">
      <Seo
        title="Über Kaderblick | Vereinssoftware für den Amateurfußball"
        description="Kaderblick entstand aus echten Problemen im Vereinsalltag: chaotische Kommunikation, fehlende Statistiken, keine Videoanalyse. Daraus wurde eine vollständige Plattform für den Amateurfußball."
        canonicalPath="/ueber-uns"
        jsonLd={[jsonLd, breadcrumbJsonLd]}
      />

      <Box component="section" className="public-features-hero">
        <Box className="public-features-hero-overlay" />

        <Container maxWidth="xl" className="public-features-shell">
          <PublicSiteHeader />
          <Box className="public-features-hero-shell">
            <Box className="public-features-hero-copy">
              <Typography className="public-features-kicker">Über Kaderblick</Typography>
              <Typography component="h1" className="public-features-title">
                Entstanden aus dem
                <span>Vereinsalltag.</span>
              </Typography>
              <Typography className="public-features-intro">
                Kaderblick entstand nicht aus einer Marktanalyse, sondern aus konkreten, wiederkehrenden
                Problemen im eigenen Vereinsleben – zu viele parallele Kanäle, keine Übersicht, keine
                eigenen Statistiken und kein vernünftiges Werkzeug für Videoanalyse. Das war der
                Ausgangspunkt.
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                className="public-features-action-row"
              >
                <Button
                  component={RouterLink}
                  to="/kontakt"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className="public-features-primary-button"
                >
                  Kontakt aufnehmen
                </Button>
                <Button
                  component={RouterLink}
                  to="/funktionen"
                  variant="outlined"
                  endIcon={<ArrowOutwardRoundedIcon />}
                  className="public-features-secondary-button"
                >
                  Funktionen entdecken
                </Button>
              </Stack>
            </Box>

            <Box className="public-features-hero-panel">
              <Typography className="public-features-panel-kicker">Hinter der Plattform</Typography>
              <Typography className="public-features-panel-title">
                Ein Entwickler. Ein Projekt. Ein Ziel.
              </Typography>
              <Box className="public-features-panel-list">
                <Box className="public-features-panel-item">
                  <Box className="public-features-panel-icon">
                    <PersonOutlinedIcon />
                  </Box>
                  <Box>
                    <Typography className="public-features-panel-item-title">Eine Person. Alles allein.</Typography>
                    <Typography className="public-features-panel-item-text">
                      Konzeption, Entwicklung, Umsetzung – nicht nur die Plattform, sondern ein
                      komplettes Ökosystem aus mehreren unabhängigen Projekten. Innerhalb eines
                      Jahres, ohne Team und ohne Investor.
                    </Typography>
                  </Box>
                </Box>

                <Box className="public-features-panel-item">
                  <Box className="public-features-panel-icon">
                    <LightbulbOutlinedIcon />
                  </Box>
                  <Box>
                    <Typography className="public-features-panel-item-title">
                      Idee aus dem eigenen Verein
                    </Typography>
                    <Typography className="public-features-panel-item-text">
                      Kein Reißbrettprojekt – sondern die direkte Antwort auf Probleme, die im
                      eigenen Fußballalltag nicht verschwinden wollten.
                    </Typography>
                  </Box>
                </Box>

                <Box className="public-features-panel-item">
                  <Box className="public-features-panel-icon">
                    <LayersOutlinedIcon />
                  </Box>
                  <Box>
                    <Typography className="public-features-panel-item-title">
                      Gesamtes Ökosystem
                    </Typography>
                    <Typography className="public-features-panel-item-text">
                      Kamerasystem, Schnittsoftware, Analyseplayer, Workflow-Automatisierung,
                      KI-gestützte Verarbeitung und Auswertung – und dazu die Plattform selbst.
                      Alles aus einer Hand.
                    </Typography>
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
                <Typography className="public-features-card-kicker">Entstehung</Typography>
                <Typography component="h2" className="public-features-summary-title">
                  Aus Vereinschaos wurde eine Plattform
                </Typography>
                <Typography className="public-features-summary-text">
                  Der Ausgangspunkt war ein typisches Bild im Amateurfußball: Terminankündigungen als
                  Sprachnachricht, Absprachen zwischen Tür und Angel, Zusagen die niemand wirklich
                  überblickt hat. Wer beim Training nicht dabei war, hatte schlicht Pech.
                  Spieler+ wurde für Zu- und Absagen genutzt, aber kaum konsequent, und die Spieler
                  mussten ständig daran erinnert werden. Eigene Statistiken oder Auswertungen gab es
                  nicht – der Überblick über Leistungen und Entwicklungen fehlte komplett.
                </Typography>
                <Typography className="public-features-summary-text">
                  Der ursprüngliche Antrieb war Videoanalyse. Kaderblick begann als reiner Empfänger
                  bereits analysierter Daten – und wuchs von dort schrittweise zu dem, was es heute
                  ist: eine vollständige Organisations-, Verwaltungs- und Auswertungsplattform für
                  Fußballvereine. Was dabei insgesamt in einem Jahr entstanden ist, geht weit über
                  die Plattform hinaus – mehr dazu im Abschnitt Das Ökosystem.
                </Typography>
              </Box>
            </Box>

            <Box className="public-features-docs-card">
              <Box className="public-features-docs-body">
                <Box className="public-features-doc-icon">
                  <VideocamOutlinedIcon />
                </Box>
                <Typography className="public-features-card-kicker">Das Ökosystem</Typography>
                <Typography component="h2" className="public-features-docs-title">
                  Mehr als eine Plattform
                </Typography>
                <Typography className="public-features-docs-text">
                  Kaderblick ist Teil eines größeren Ökosystems. Neben der Web-App entstanden: ein
                  eigenes Kamerasystem für Spielaufnahmen, eine Schnittsoftware zum Exportieren und
                  Aufbereiten von Szenen, ein Analyseplayer der Videos direkt anhand von Schnittmarken
                  abspielt, automatisierte Workflows zur Verarbeitung und Veröffentlichung der
                  Aufnahmen sowie KI-gestützte Software zur Analyse und Auswertung des Spielgeschehens.
                  Die Videos werden auf YouTube bereitgestellt und in Kaderblick über Zeitstempel
                  direkt mit den Spielereignissen verknüpft.
                </Typography>
              </Box>
            </Box>
          </Stack>

          <Stack spacing={2.2}>
            <Box className="public-features-summary-card">
              <Box className="public-features-summary-body">
                <Typography className="public-features-card-kicker">Mission</Typography>
                <Typography component="h2" className="public-features-summary-title">
                  Amateurfußball auf ein neues Level bringen
                </Typography>
                <Typography className="public-features-summary-text">
                  Kaderblick soll langfristig die Zusammenarbeit im Amateurfußball vereinfachen und
                  zentralisieren. Von wiederkehrenden Aufgaben wie Terminorganisation und Zu-/Absagen
                  über Taktikbesprechungen mit hinterlegten Aufstellungen bis hin zur Videoanalyse nach
                  dem Spiel – alles in einer Plattform.
                </Typography>
                <Typography className="public-features-summary-text">
                  Das Ziel ist, jedem Verein und seinen Teams die Möglichkeit zu geben, sich
                  unkompliziert und professionell zu organisieren – ohne hohe Kosten und ohne fünf
                  verschiedene Insellösungen. Was bisher nur Profivereinen zugänglich war, soll im
                  Amateursport für jeden erreichbar sein.
                </Typography>
              </Box>
            </Box>

            <Box className="public-features-docs-card">
              <Box className="public-features-docs-body">
                <Typography className="public-features-card-kicker">Aktueller Stand</Typography>
                <Typography component="h2" className="public-features-docs-title">
                  In aktiver Entwicklung
                </Typography>
                <Typography className="public-features-docs-text">
                  Kaderblick befindet sich aktuell in der Testphase und wird im eigenen Verein
                  aktiv erprobt. Die internen Funktionen sind weitgehend abgeschlossen –
                  der Fokus liegt jetzt auf dem öffentlichen Auftritt und der Vorbereitung für
                  einen breiteren Einsatz.
                </Typography>
                <Stack spacing={1.1} sx={{ mt: 2 }}>
                  <Button
                    component={RouterLink}
                    to="/kontakt"
                    variant="outlined"
                    endIcon={<ArrowForwardRoundedIcon />}
                    className="public-features-doc-link"
                  >
                    Kontakt aufnehmen
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/funktionen"
                    variant="outlined"
                    endIcon={<ArrowOutwardRoundedIcon />}
                    className="public-features-doc-link"
                  >
                    Funktionen entdecken
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

export default AboutUs;
