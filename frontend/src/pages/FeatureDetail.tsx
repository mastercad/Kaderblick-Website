import React from 'react';
import {
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Container,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import Seo from '../seo/Seo';
import { marketingFeatures } from '../content/marketingContent';
import { DOCS_URL } from '../seo/siteConfig';
import '../styles/public-features.css';

const featureRelevanceCards: Record<string, Array<{ title: string; text: string }>> = {
  'vereinskalender-events': [
    {
      title: 'Wenn Termine noch in mehreren Chats leben',
      text: 'Sobald Trainingszeiten, Treffpunkte und Änderungen parallel über Messenger, Zurufe und Kalenderfotos verteilt werden, fehlt eine verlässliche gemeinsame Taktung.',
    },
    {
      title: 'Wenn Eltern und Trainer nie denselben Stand haben',
      text: 'Der Kalender wird relevant, wenn beide Seiten dieselbe Uhrzeit, denselben Ort und dieselbe Änderung sehen müssen, ohne dass jemand ständig nachtelefoniert.',
    },
    {
      title: 'Wenn Wochenplanung nicht improvisiert sein soll',
      text: 'Gerade bei mehreren Teams, Spielen und Zusatzterminen braucht Vereinsalltag eine zentrale Planungsfläche statt lose Einzelabsprachen.',
    },
  ],
  'zusagen-teilnahmen': [
    {
      title: 'Wenn Training erst kurz vorher planbar wird',
      text: 'Teilnahmen sind dann kritisch, wenn Trainer bis zuletzt nicht wissen, ob acht oder achtzehn Spieler auf dem Platz stehen werden.',
    },
    {
      title: 'Wenn Rückmeldungen in Einzelchats verschwinden',
      text: 'Sobald Zu- und Absagen über private Nachrichten, Gruppenchat und mündliche Zusagen verteilt sind, fehlt jede belastbare Übersicht.',
    },
    {
      title: 'Wenn Auswärtsfahrten an Kleinigkeiten scheitern',
      text: 'Gerade bei Treffpunkten, Fahrgemeinschaften und Spieltagsorganisation entscheidet eine saubere Rückmeldelogik darüber, ob der Ablauf ruhig oder chaotisch wird.',
    },
  ],
  'umfragen-feedback': [
    {
      title: 'Wenn Entscheidungen sonst nur nach Lautstärke fallen',
      text: 'Umfragen helfen dort, wo Vereine Rückmeldungen strukturiert einsammeln müssen statt sich auf Bauchgefühl oder Einzelmeinungen zu verlassen.',
    },
    {
      title: 'Wenn Beteiligung gewollt ist, aber nicht organisiert',
      text: 'Ob Elternabend, Trainerabstimmung oder Vereinsentwicklung: Feedback wird erst dann nützlich, wenn es gesammelt, vergleichbar und nachvollziehbar ankommt.',
    },
    {
      title: 'Wenn Rückkanäle nicht wieder im Chat enden sollen',
      text: 'Die Funktion ist besonders wertvoll, wenn Meinungen nicht zwischen Reaktionen, Sprachnachrichten und Nebenabsprachen verloren gehen dürfen.',
    },
  ],
  'spielanalyse-spielverwaltung': [
    {
      title: 'Wenn Spieltag und Analyse heute zwei Welten sind',
      text: 'Sobald Ereignisse separat notiert, Videos woanders gespeichert und Erkenntnisse später mühsam zusammengesucht werden, fehlt ein durchgängiger Analyseablauf.',
    },
    {
      title: 'Wenn Nachbereitung zu viel Handarbeit kostet',
      text: 'Trainer und Analysten profitieren hier, wenn sie nicht erst nach Abpfiff Daten, Szenen und Notizen aus mehreren Quellen zusammenziehen wollen.',
    },
    {
      title: 'Wenn Erkenntnisse schneller ins nächste Training sollen',
      text: 'Der Bereich wird relevant, wenn Analyse nicht archiviert, sondern als konkrete Grundlage für Besprechung und Trainingsschwerpunkt genutzt werden soll.',
    },
  ],
  'trainer-tools-formationen': [
    {
      title: 'Wenn Aufstellungen nur auf dem letzten Zettel existieren',
      text: 'Formationen helfen besonders dann, wenn Vorbereitung nicht jedes Mal neu improvisiert, sondern nachvollziehbar aufgebaut werden soll.',
    },
    {
      title: 'Wenn Trainerideen im Alltag verloren gehen',
      text: 'Wer Varianten, Rollen und Hinweise bisher auf Whiteboardfotos oder privaten Notizen festhält, braucht einen Ort, an dem Vorbereitung wiederverwendbar wird.',
    },
    {
      title: 'Wenn Co-Trainer denselben Plan sehen sollen',
      text: 'Sobald mehrere Personen an Spielvorbereitung beteiligt sind, schafft eine gemeinsame visuelle Arbeitsgrundlage deutlich mehr Klarheit.',
    },
  ],
  'vereins-stammdaten': [
    {
      title: 'Wenn dieselben Personen an drei Stellen gepflegt werden',
      text: 'Stammdaten sind dann relevant, wenn Teams, Rollen und Kontakte heute doppelt, veraltet oder nur in Einzelwissen vorhanden sind.',
    },
    {
      title: 'Wenn Organisation von Listenqualität abhängt',
      text: 'Sobald Zuständigkeiten, Zuordnungen und Strukturen nicht sauber hinterlegt sind, werden auch Kommunikation und Planung automatisch fehleranfälliger.',
    },
    {
      title: 'Wenn der Verein nicht an Einzelpersonen hängen darf',
      text: 'Gerade bei Wechseln im Trainerteam oder in der Jugendleitung braucht der Verein eine belastbare Datenbasis statt gewachsener Insellisten.',
    },
  ],
  'spielstätten-navigation': [
    {
      title: 'Wenn vor jedem Auswärtsspiel dieselben Fragen kommen',
      text: 'Die Funktion wird relevant, sobald Eltern und Betreuer regelmäßig nach genauer Adresse, Treffpunkt oder Zufahrt fragen müssen.',
    },
    {
      title: 'Wenn ein unklarer Ort sofort Unruhe auslöst',
      text: 'Schon kleine Unschärfen bei Spielort oder Treffpunkt ziehen Rückfragen, Verspätungen und unnötige Abstimmung nach sich.',
    },
    {
      title: 'Wenn Organisation auch unterwegs belastbar bleiben soll',
      text: 'Gerade mobil hilft ein sauber hinterlegter Ort mehr als irgendein Text im Chat, weil Navigation und Kontext direkt zusammengehören.',
    },
  ],
  'berichte-analysen': [
    {
      title: 'Wenn Entscheidungen bisher nur aus Gefühl entstehen',
      text: 'Berichte werden relevant, wenn Trainer oder Leitung Entwicklungen nicht nur ahnen, sondern begründet erkennen und besprechen wollen.',
    },
    {
      title: 'Wenn Zahlen mehr sein sollen als Dekoration',
      text: 'Der Bereich hilft dort, wo Kennzahlen konkrete Fragen beantworten sollen: Beteiligung, Entwicklung, Belastung oder organisatorische Qualität.',
    },
    {
      title: 'Wenn Verein und Trainer dieselbe Datengrundlage brauchen',
      text: 'Sobald operative und sportliche Entscheidungen nachvollziehbar werden sollen, ist eine gemeinsame Sicht auf relevante Auswertungen entscheidend.',
    },
  ],
  'vereins-kommunikation': [
    {
      title: 'Wenn Wichtige Infos in Messenger-Fluten untergehen',
      text: 'Kommunikation wird zum Problem, wenn Relevantes zwischen privaten Nachrichten, Gruppen und spontanen Hinweisen nicht mehr sauber ankommt.',
    },
    {
      title: 'Wenn niemand sicher sagen kann, wer was gesehen hat',
      text: 'Gerade für Vereine mit vielen Teams braucht Information einen nachvollziehbaren organisatorischen Ort statt zufälliger Streuung.',
    },
    {
      title: 'Wenn Ruhe im Alltag wichtiger ist als noch ein Kanal',
      text: 'Die Funktion ist dann wertvoll, wenn Kommunikation nicht lauter, sondern klarer, planbarer und weniger personenabhängig werden soll.',
    },
  ],
};

const FeatureDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const feature = marketingFeatures.find((entry) => entry.slug === slug);

  if (!feature) {
    return <Navigate to="/funktionen" replace />;
  }

  const relevanceCards = featureRelevanceCards[feature.slug] ?? [];

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Startseite',
        item: 'https://kaderblick.de/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Funktionen',
        item: 'https://kaderblick.de/funktionen',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: feature.name,
        item: `https://kaderblick.de/funktionen/${feature.slug}`,
      },
    ],
  };

  return (
    <Box className="public-features">
      <Seo
        title={feature.seoTitle}
        description={feature.seoDescription}
        canonicalPath={`/funktionen/${feature.slug}`}
        jsonLd={breadcrumbJsonLd}
      />

      <Box component="section" className="public-features-detail-hero">
        <Box className="public-features-hero-overlay" />

        <Container maxWidth="xl" className="public-features-shell">
          <PublicSiteHeader />
          <Box className="public-features-hero-shell">
            <Box className="public-features-hero-copy">
              <Breadcrumbs aria-label="Breadcrumb" className="public-features-breadcrumbs">
                <Link component={RouterLink} underline="hover" to="/" className="public-features-breadcrumb-link">
                  Startseite
                </Link>
                <Link component={RouterLink} underline="hover" to="/funktionen" className="public-features-breadcrumb-link">
                  Funktionen
                </Link>
                <Typography className="public-features-breadcrumb-current">{feature.name}</Typography>
              </Breadcrumbs>

              <Typography className="public-features-detail-kicker">Themenseite</Typography>
              <Typography component="h1" className="public-features-title">
                {feature.name}
              </Typography>
              <Typography className="public-features-intro">
                {feature.teaser}
              </Typography>

              <Box className="public-features-detail-chip-row" sx={{ mt: 2.1 }}>
                {feature.suitableFor.map((entry) => (
                  <Chip key={entry} label={entry} className="public-features-detail-chip" />
                ))}
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="public-features-action-row">
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
                  className="public-features-secondary-button"
                >
                  Weitere Funktionen ansehen
                </Button>
              </Stack>
            </Box>

            <Box className="public-features-detail-stage">
              <Box component="img" src={feature.image} alt={feature.name} />
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" className="public-features-shell public-features-main">
        <Box className="public-features-detail-main">
          <Stack spacing={2.5}>
            <Box className="public-features-summary-card">
              <Box className="public-features-summary-body">
                <Typography className="public-features-card-kicker">Einordnung</Typography>
                <Typography component="h2" className="public-features-summary-title">
                  {feature.summaryTitle ?? `Worum es bei ${feature.name} wirklich geht`}
                </Typography>
                <Typography className="public-features-summary-text">
                  {feature.summary}
                </Typography>
              </Box>
            </Box>

            <Box component="section" className="public-features-section" sx={{ mt: '0.8rem !important' }}>
              <Box className="public-features-section-head">
                <Box>
                  <Typography className="public-features-section-kicker">Nutzen</Typography>
                  <Typography component="h2" className="public-features-section-title">
                    {feature.valueTitle ?? 'Was dieser Bereich im Vereinsalltag verbessert'}
                  </Typography>
                </Box>
                {feature.valueIntro ? (
                  <Typography className="public-features-section-text">
                    {feature.valueIntro}
                  </Typography>
                ) : null}
              </Box>

              <Box className="public-features-benefit-grid">
                {feature.benefits.map((benefit) => (
                  <Box key={benefit} className="public-features-benefit-card">
                    <Box className="public-features-benefit-icon">
                      <CheckCircleOutlineRoundedIcon />
                    </Box>
                    <Typography className="public-features-benefit-text">{benefit}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {relevanceCards.length > 0 ? (
              <Box component="section" className="public-features-section">
              <Box className="public-features-section-head">
                <Box>
                  <Typography className="public-features-section-kicker">Relevanz</Typography>
                  <Typography component="h2" className="public-features-section-title">
                    Woran Vereine merken, dass genau dieser Bereich fehlt
                  </Typography>
                </Box>
                <Typography className="public-features-section-text">
                  Diese Seite soll nicht nur sagen, für wen die Funktion gedacht ist, sondern in welchen konkreten Situationen ihr Fehlen sofort spürbar wird.
                </Typography>
              </Box>

              <Box className="public-features-benefit-grid">
                {relevanceCards.map((entry) => (
                  <Box key={entry.title} className="public-features-benefit-card">
                    <Typography className="public-features-benefit-title">{entry.title}</Typography>
                    <Typography className="public-features-benefit-text">{entry.text}</Typography>
                  </Box>
                ))}
              </Box>
              </Box>
            ) : null}
          </Stack>

          <Stack spacing={2.5}>
            <Box className="public-features-docs-card">
              <Box className="public-features-docs-body">
                <Box className="public-features-doc-icon">
                  <MenuBookRoundedIcon />
                </Box>
                <Typography className="public-features-card-kicker">Vertiefung</Typography>
                <Typography component="h2" className="public-features-docs-title">
                  So geht es nach der Einordnung weiter
                </Typography>
                <Typography className="public-features-docs-text">
                  Wenn du nach dem Überblick in konkrete Abläufe, Bedienung oder Einrichtung gehen willst, kommst du über diese Kapitel direkt in die fachliche Tiefe.
                </Typography>
                <Stack spacing={1.1} sx={{ mt: 2 }}>
                  {feature.docsLinks.map((entry) => (
                    <Button
                      key={entry.url}
                      component="a"
                      href={entry.url}
                      target="_blank"
                      rel="noreferrer"
                      variant="outlined"
                      endIcon={<ArrowOutwardRoundedIcon />}
                      className="public-features-doc-link"
                    >
                      {entry.label}
                    </Button>
                  ))}
                  <Button
                    component="a"
                    href={DOCS_URL}
                    target="_blank"
                    rel="noreferrer"
                    variant="text"
                    endIcon={<ArrowOutwardRoundedIcon />}
                    sx={{ justifyContent: 'flex-start', px: 0, color: '#208e39', fontWeight: 700, textTransform: 'none' }}
                  >
                    Gesamte Dokumentation öffnen
                  </Button>
                </Stack>
              </Box>
            </Box>

            <Box className="public-features-cta-panel">
              <Box className="public-features-cta-body">
                <Typography className="public-features-card-kicker" sx={{ color: 'rgba(255,255,255,0.82) !important' }}>
                  Weiterdenken
                </Typography>
                <Typography component="h2" className="public-features-cta-title">
                  Prüfen, ob das für euren Verein passt
                </Typography>
                <Typography className="public-features-cta-text">
                  Wenn dieser Bereich ein konkretes Problem in eurem Alltag löst, ist der nächste sinnvolle Schritt kein weiterer Screenshot, sondern die Einordnung für euren Verein, euer Trainerteam oder eure Organisation.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2.1 }}>
                  <Button
                    component={RouterLink}
                    to="/kontakt"
                    variant="contained"
                    endIcon={<ArrowForwardRoundedIcon />}
                    className="public-features-ghost-button"
                  >
                    Kontakt aufnehmen
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/funktionen"
                    variant="outlined"
                    className="public-features-secondary-button"
                  >
                    Alle Funktionen
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

export default FeatureDetail;