import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import Groups2OutlinedIcon from '@mui/icons-material/Groups2Outlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { Link as RouterLink } from 'react-router-dom';
import DemoRequestModal from '../modals/DemoRequestModal';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import Seo from '../seo/Seo';
import '../styles/public-features.css';

const coreBenefits = [
  {
    title: 'Weniger Organisationsaufwand im Tagesgeschäft',
    text: 'Viele Vereine arbeiten parallel mit Chatgruppen, Tabellen, Kalendern und einzelnen Notizen. Das kostet nicht nur Zeit, sondern erzeugt Medienbrüche, Nachfragen und unnötige Wiederholungen. Kaderblick bündelt diese Abläufe an einem Ort, damit Informationen, Rückmeldungen und Zuständigkeiten nicht jedes Mal neu zusammengesucht werden müssen.',
    icon: AccessTimeOutlinedIcon,
  },
  {
    title: 'Klarere Kommunikation für Trainer, Eltern und Teams',
    text: 'Missverständnisse entstehen im Vereinsalltag selten aus mangelndem Einsatz, sondern aus verteilten Informationen. Wenn Änderungen, Entscheidungen und relevante Hinweise nachvollziehbar ankommen, wird Zusammenarbeit ruhiger und verlässlicher. Genau dieser gemeinsame Informationsstand entlastet nicht nur einzelne Personen, sondern den gesamten Ablauf.',
    icon: ForumOutlinedIcon,
  },
  {
    title: 'Mehr Verbindlichkeit bei Terminen und Rückmeldungen',
    text: 'Planung wird erst dann belastbar, wenn Zusagen, Absagen und offene Rückmeldungen sichtbar sind. Kaderblick schafft dafür einen klaren Rahmen, in dem Verantwortliche früher erkennen, wo noch Handlungsbedarf besteht. Das senkt die operative Unsicherheit und verbessert die Grundlage für Trainings-, Spiel- und Einsatzplanung.',
    icon: Groups2OutlinedIcon,
  },
  {
    title: 'Bessere Entscheidungen durch echten Überblick',
    text: 'Wer den aktuellen Stand zu Terminen, Teilnahmen, Kommunikation und Spielbetrieb schnell erfassen kann, arbeitet vorausschauender und muss seltener improvisieren. Kaderblick schafft genau diesen Überblick, damit Entscheidungen nicht aus dem Bauch oder aus verstreuten Einzelinformationen heraus getroffen werden.',
    icon: InsightsOutlinedIcon,
  },
  {
    title: 'Datensicherheit und Verantwortung besser im Griff',
    text: 'Sensible Vereinsinformationen gehören nicht dauerhaft in private Chats, verteilte Listen und gewachsene Zwischenlösungen. Ein zentraler, nachvollziehbarer Rahmen verbessert nicht nur die Organisation, sondern auch den Umgang mit Daten, Zuständigkeiten und Datenschutz. Das ist professioneller und langfristig deutlich robuster.',
    icon: ShieldOutlinedIcon,
  },
];

const proofPoints = [
  'Weniger Abstimmung über Nebenkanäle und weniger Informationsverluste im Alltag.',
  'Mehr Ruhe in Planung und Kommunikation, weil alle mit demselben Stand arbeiten.',
  'Mehr Zeit für sportliche Arbeit, weil organisatorische Reibung deutlich kleiner wird.',
];

const BenefitsOverview: React.FC = () => {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Vorteile von Kaderblick',
    url: 'https://kaderblick.de/vorteile',
    description: 'Warum Kaderblick für Fußballvereine operativ relevant ist: weniger Abstimmungschaos, klarere Kommunikation, mehr Verbindlichkeit und besserer Überblick im Vereinsalltag.',
  };

  return (
    <Box className="public-features">
      <Seo
        title="Vorteile für Fußballvereine | Kaderblick"
        description="Warum Kaderblick im Vereinsalltag einen echten Unterschied macht: weniger Organisationsaufwand, klarere Kommunikation, mehr Verbindlichkeit und besserer Überblick für Trainer, Teams und Verantwortliche."
        canonicalPath="/vorteile"
        jsonLd={jsonLd}
      />

      <Box component="section" className="public-features-hero">
        <Box className="public-features-hero-overlay" />

        <Container maxWidth="xl" className="public-features-shell">
          <PublicSiteHeader onOpenDemo={() => setDemoModalOpen(true)} />
          <Box className="public-features-hero-shell">
            <Box className="public-features-hero-copy">
              <Typography className="public-features-kicker">
                Öffentliche Produktseite
              </Typography>
              <Typography component="h1" className="public-features-title">
                Weniger Abstimmung,
                <span>mehr Klarheit im Vereinsalltag.</span>
              </Typography>
              <Typography className="public-features-intro">
                Im Vereinsalltag geht selten Zeit an den wichtigen Themen verloren, sondern an der Organisation dazwischen: fehlende Rückmeldungen, verteilte Informationen, kurzfristige Änderungen und doppelte Abstimmungen. Kaderblick bündelt diese Abläufe an einem Ort und macht sie für Trainer, Verantwortliche, Spieler und Eltern nachvollziehbar. Das Ergebnis ist kein Selbstzweck in Form von mehr Software, sondern ein strukturierterer, verlässlicherer und spürbar ruhigerer Alltag im Verein.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="public-features-action-row">
                <Button
                  component={RouterLink}
                  to="/vorteile"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className="public-features-primary-button"
                >
                  Vorteile entdecken
                </Button>
                <Button
                  onClick={() => setDemoModalOpen(true)}
                  variant="outlined"
                  className="public-features-secondary-button"
                >
                  Demo anfragen
                </Button>
              </Stack>

              <Box className="public-features-stat-grid">
                <Box className="public-features-stat-card">
                  <Typography className="public-features-stat-value">Weniger</Typography>
                  <Typography className="public-features-stat-label">Nachfragen, doppelte Pflege und Abstimmung über mehrere Nebenkanäle</Typography>
                </Box>
                <Box className="public-features-stat-card">
                  <Typography className="public-features-stat-value">Mehr</Typography>
                  <Typography className="public-features-stat-label">Verbindlichkeit bei Rückmeldungen, Zuständigkeiten und Planungsständen</Typography>
                </Box>
                <Box className="public-features-stat-card">
                  <Typography className="public-features-stat-value">Klarheit</Typography>
                  <Typography className="public-features-stat-label">für Trainer, Eltern, Teams und Vereinsverantwortliche im Tagesgeschäft</Typography>
                </Box>
              </Box>
            </Box>

            <Box className="public-features-hero-panel">
              <Typography className="public-features-panel-kicker">Der operative Mehrwert</Typography>
              <Typography className="public-features-panel-title">Warum das im Alltag spürbar etwas verändert</Typography>
              <Box className="public-features-panel-list">
                {proofPoints.map((point) => (
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
        <Box component="section" id="benefit-grid" className="public-features-section">
          <Box className="public-features-section-head">
            <Box>
              <Typography className="public-features-section-kicker">Vereinsnutzen</Typography>
              <Typography component="h2" className="public-features-section-title">
                Vorteile, die nicht nach Marketing klingen müssen, um relevant zu sein
              </Typography>
            </Box>
            <Typography className="public-features-section-text">
              Die Stärke von Kaderblick liegt nicht in der bloßen Anzahl einzelner Funktionen, sondern darin, dass typische Reibung im Vereinsalltag kleiner wird. Wer heute zwischen Chatgruppen, Listen, Kalendern und Personenwissen organisiert, gewinnt mit einer zentralen Struktur vor allem eines zurück: belastbare Ruhe im Tagesgeschäft.
            </Typography>
          </Box>

          <Box className="public-features-grid">
            {coreBenefits.map((benefit) => {
              const Icon = benefit.icon;

              return (
                <Box key={benefit.title} className="public-features-card">
                  <Box className="public-features-card-body">
                    <Box className="public-features-panel-icon" sx={{ mb: 2 }}>
                      <Icon />
                    </Box>
                    <Typography className="public-features-card-kicker">Vorteil</Typography>
                    <Typography component="h2" className="public-features-card-title">
                      {benefit.title}
                    </Typography>
                    <Typography className="public-features-card-text">
                      {benefit.text}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box component="section" className="public-features-section">
          <Box className="public-features-spotlight">
            <Box className="public-features-spotlight-copy">
              <Typography className="public-features-section-kicker">Was das praktisch bedeutet</Typography>
              <Typography component="h2" className="public-features-spotlight-title">
                Professioneller arbeiten, ohne den Alltag komplizierter zu machen
              </Typography>
              <Typography className="public-features-spotlight-text">
                Viele Vereine wollen bessere Abläufe, aber keine zusätzliche Komplexität. Genau deshalb ist der entscheidende Punkt nicht, ob eine Software viel kann, sondern ob sie organisatorische Reibung wirklich reduziert. Wenn Planung, Kommunikation und Rückmeldungen in einer klaren Struktur zusammenlaufen, wird Vereinsarbeit nicht technischer, sondern einfacher steuerbar.
              </Typography>

              <Box className="public-features-spotlight-list">
                <Box className="public-features-spotlight-item">
                  <CheckCircleOutlineRoundedIcon />
                  <Typography className="public-features-card-text">Weniger operative Hektik, weil offene Punkte und Zuständigkeiten sichtbar bleiben.</Typography>
                </Box>
                <Box className="public-features-spotlight-item">
                  <CheckCircleOutlineRoundedIcon />
                  <Typography className="public-features-card-text">Weniger Personenabhängigkeit, weil Wissen und Kommunikation nicht an Einzelne gebunden sind.</Typography>
                </Box>
                <Box className="public-features-spotlight-item">
                  <CheckCircleOutlineRoundedIcon />
                  <Typography className="public-features-card-text">Mehr Qualität im Alltag, weil organisatorische Klarheit sportliche Arbeit überhaupt erst entlastet.</Typography>
                </Box>
              </Box>
            </Box>

            <Box className="public-features-spotlight-visual">
              <Box component="img" src="/images/landing_page/game_overview.png" alt="Kaderblick für strukturierten Vereinsalltag" />
            </Box>
          </Box>
        </Box>

        <Box component="section" className="public-features-section">
          <Box className="public-features-spotlight">
            <Box className="public-features-spotlight-copy">
              <Typography className="public-features-section-kicker">Nächster Schritt</Typography>
              <Typography component="h2" className="public-features-spotlight-title">
                Wenn genau diese Reibung bei euch Zeit frisst, lohnt sich der Blick in die Plattform
              </Typography>
              <Typography className="public-features-spotlight-text">
                Die relevante Frage ist nicht, ob digitale Vereinsarbeit grundsätzlich sinnvoll ist. Die relevante Frage ist, ob eure aktuelle Organisation Trainer, Teams und Verantwortliche unnötig ausbremst. Wenn das der Fall ist, zeigt eine Demo schnell, wo Kaderblick konkret entlastet und wie die Plattform in euren Alltag passen kann.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="public-features-action-row">
                <Button
                  onClick={() => setDemoModalOpen(true)}
                  variant="contained"
                  endIcon={<ArrowOutwardRoundedIcon />}
                  className="public-features-primary-button"
                >
                  Demo anfragen
                </Button>
                <Button
                  component={RouterLink}
                  to="/funktionen"
                  variant="outlined"
                  className="public-features-secondary-button"
                >
                  Funktionen ansehen
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Container>

      <DemoRequestModal open={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
    </Box>
  );
};

export default BenefitsOverview;