import React from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import Seo from '../seo/Seo';
import { intentPages, marketingFeatures } from '../content/marketingContent';
import { DOCS_URL } from '../seo/siteConfig';
import '../styles/public-features.css';

const intentPageMessaging: Record<string, {
  panelTitle: string;
  panelItems: Array<{ title: string; text: string; icon: 'check' | 'docs' }>;
  ctaTitle: string;
  ctaText: string;
}> = {
  '/für-trainer': {
    panelTitle: 'Weshalb Trainer hier weiterlesen sollten',
    panelItems: [
      {
        title: 'Wenn Wochenplanung zu viel Nebenarbeit frisst',
        text: 'Diese Seite ist für Trainer gedacht, die Termine, Rückmeldungen, Vorbereitung und Nachbereitung nicht länger über mehrere Werkzeuge, Zettel und Chatgruppen verteilen wollen.',
        icon: 'check',
      },
      {
        title: 'Wenn aus Organisation wieder echte Trainerarbeit werden soll',
        text: 'Hier soll schnell klar werden, ob Kaderblick nicht nur Funktionen anbietet, sondern den Trainings- und Spielalltag tatsächlich spürbar entlastet.',
        icon: 'docs',
      },
    ],
    ctaTitle: 'Prüfen, ob das euren Traineralltag wirklich entlastet',
    ctaText: 'Wenn ihr an genau diesen Punkten Woche für Woche Zeit verliert, ist jetzt die relevante Frage, ob Kaderblick aus verstreuter Organisation wieder einen belastbaren Trainer-Workflow macht.',
  },
  '/für-eltern': {
    panelTitle: 'Weshalb Eltern hier überhaupt weiterlesen',
    panelItems: [
      {
        title: 'Wenn Informationen im Alltag zu spät oder verstreut kommen',
        text: 'Diese Seite richtet sich an Vereine und Teams, die Elternkommunikation endlich ruhiger, klarer und verlässlicher machen wollen.',
        icon: 'check',
      },
      {
        title: 'Wenn weniger Rückfragen schon ein echter Fortschritt wären',
        text: 'Hier geht es nicht um Technik um der Technik willen, sondern darum, ob Termine, Treffpunkte, Zusagen und News für Familien endlich sauber zusammenlaufen.',
        icon: 'docs',
      },
    ],
    ctaTitle: 'Prüfen, ob eure Elternkommunikation damit wirklich ruhiger wird',
    ctaText: 'Wenn rund um Fahrten, Treffpunkte und Rückmeldungen ständig dieselben Rückfragen entstehen, ist jetzt entscheidend, ob Kaderblick diese Unruhe wirklich aus dem Alltag herausnimmt.',
  },
  '/für-jugendleitung': {
    panelTitle: 'Weshalb das für Jugendleitung mehr als ein Tool-Thema ist',
    panelItems: [
      {
        title: 'Wenn Überblick heute von Einzellisten abhängt',
        text: 'Die Seite ist für Verantwortliche gedacht, die Struktur, Kommunikation und Zuständigkeiten nicht länger auf gewachsene Insellösungen und Personenwissen stützen wollen.',
        icon: 'check',
      },
      {
        title: 'Wenn der Verein weniger personenabhängig werden soll',
        text: 'Hier soll schnell sichtbar werden, ob Kaderblick operative Vereinsarbeit robuster und steuerbarer macht, bevor ihr euch mit Detailkonfiguration beschäftigt.',
        icon: 'docs',
      },
    ],
    ctaTitle: 'Prüfen, ob das eure Vereinsorganisation robuster macht',
    ctaText: 'Wenn Wissen, Zuständigkeiten und Kommunikation heute zu stark an einzelne Personen oder Einzellisten gebunden sind, ist jetzt die entscheidende Frage, ob Kaderblick daraus eine belastbare Vereinsstruktur macht.',
  },
  '/spielanalyse-software': {
    panelTitle: 'Weshalb Analyse im Amateurfußball meist am Workflow scheitert',
    panelItems: [
      {
        title: 'Wenn Daten, Video und Erkenntnisse nicht zusammenfinden',
        text: 'Diese Seite richtet sich an Trainer und Teams, die Analyse nicht theoretisch wollen, sondern in einem alltagstauglichen Ablauf wirklich nutzbar machen müssen.',
        icon: 'check',
      },
      {
        title: 'Wenn Nachbereitung schneller zu Training führen soll',
        text: 'Hier soll klar werden, ob Kaderblick mehr ist als ein weiteres Analyseversprechen und ob der Workflow wirklich von Spieltag bis Trainingsplanung trägt.',
        icon: 'docs',
      },
    ],
    ctaTitle: 'Prüfen, ob euer Analyseprozess damit endlich praktikabel wird',
    ctaText: 'Wenn Analyse heute an Medienbrüchen, Handarbeit oder Zeitmangel scheitert, geht es jetzt darum, ob Kaderblick daraus einen nutzbaren Ablauf macht und nicht nur ein gutes Versprechen liefert.',
  },
};

const PublicIntentPage: React.FC = () => {
  const location = useLocation();
  const normalizedPath = (() => {
    try {
      return decodeURIComponent(location.pathname);
    } catch {
      return location.pathname;
    }
  })();
  const currentPage = intentPages.find((page) => page.path === normalizedPath);

  if (!currentPage) {
    return <Navigate to="/" replace />;
  }

  const pageMessaging = intentPageMessaging[currentPage.path];

  const linkedFeatures = currentPage.linkedFeatures
    .map((slug) => marketingFeatures.find((feature) => feature.slug === slug))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: currentPage.headline,
    description: currentPage.seoDescription,
    url: `https://kaderblick.de${currentPage.path}`,
  };

  return (
    <Box className="public-features">
      <Seo
        title={currentPage.seoTitle}
        description={currentPage.seoDescription}
        canonicalPath={currentPage.path}
        jsonLd={jsonLd}
      />

      <Box component="section" className="public-features-hero">
        <Box className="public-features-hero-overlay" />

        <Container maxWidth="xl" className="public-features-shell">
          <PublicSiteHeader />
          <Box className="public-features-hero-shell">
            <Box className="public-features-hero-copy">
              <Typography className="public-features-kicker">Suchintention</Typography>
              <Typography component="h1" className="public-features-title">
                {currentPage.headline}
              </Typography>
              <Typography className="public-features-intro">
                {currentPage.intro}
              </Typography>

              <Box className="public-features-detail-chip-row" sx={{ mt: 2.1 }}>
                <Chip label={currentPage.label} className="public-features-detail-chip" />
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="public-features-action-row">
                <Button
                  component="a"
                  href="#bedarf"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className="public-features-primary-button"
                >
                  Bedarf einordnen
                </Button>
                <Button
                  component={RouterLink}
                  to="/kontakt"
                  variant="outlined"
                  className="public-features-secondary-button"
                >
                  Kontakt aufnehmen
                </Button>
              </Stack>
            </Box>

            <Box className="public-features-hero-panel">
              <Typography className="public-features-panel-kicker">Einordnung</Typography>
              <Typography className="public-features-panel-title">{pageMessaging?.panelTitle ?? 'Wofür diese Seite gedacht ist'}</Typography>
              <Box className="public-features-panel-list">
                {(pageMessaging?.panelItems ?? []).map((item) => (
                  <Box key={item.title} className="public-features-panel-item">
                    <Box className="public-features-panel-icon">
                      {item.icon === 'check' ? <CheckCircleOutlineRoundedIcon /> : <MenuBookRoundedIcon />}
                    </Box>
                    <Box>
                      <Typography className="public-features-panel-item-title">{item.title}</Typography>
                      <Typography className="public-features-panel-item-text">{item.text}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" className="public-features-shell public-features-main">
        <Box className="public-features-content-shell">
          <Stack spacing={2.2}>
            <Box className="public-features-summary-card">
              <Box className="public-features-summary-body">
                <Typography className="public-features-card-kicker">Zusammenfassung</Typography>
                <Typography component="h2" className="public-features-summary-title">
                  {currentPage.summaryTitle ?? `Was ${currentPage.label} mit Kaderblick schneller lösen kann`}
                </Typography>
                <Typography className="public-features-summary-text">
                  {currentPage.summary}
                </Typography>
              </Box>
            </Box>

            <Box component="section" id="bedarf" className="public-features-section" sx={{ mt: '0 !important' }}>
              <Box className="public-features-section-head">
                <Box>
                  <Typography className="public-features-section-kicker">Nutzen</Typography>
                  <Typography component="h2" className="public-features-section-title">
                    {currentPage.valueTitle ?? 'Wobei Kaderblick in diesem Bereich hilft'}
                  </Typography>
                </Box>
                {currentPage.valueIntro ? (
                  <Typography className="public-features-section-text">
                    {currentPage.valueIntro}
                  </Typography>
                ) : null}
              </Box>

              <Box className="public-features-benefit-grid">
                {currentPage.benefits.map((benefit) => (
                  <Box key={benefit} className="public-features-benefit-card">
                    <Box className="public-features-benefit-icon">
                      <CheckCircleOutlineRoundedIcon />
                    </Box>
                    <Typography className="public-features-benefit-text">{benefit}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box component="section" className="public-features-section">
              <Box className="public-features-section-head">
                <Box>
                  <Typography className="public-features-section-kicker">Passende Funktionen</Typography>
                  <Typography component="h2" className="public-features-section-title">
                    Relevante Produktbereiche für diesen Bedarf
                  </Typography>
                </Box>
              </Box>

              <Box className="public-features-grid">
                {linkedFeatures.map((feature) => (
                  <Box key={feature.slug} className="public-features-card">
                    <Box className="public-features-card-media">
                      <Box component="img" src={feature.image} alt={feature.name} />
                    </Box>
                    <Box className="public-features-card-body">
                      <Typography className="public-features-card-kicker">Funktion</Typography>
                      <Typography component="h3" className="public-features-card-title">
                        {feature.name}
                      </Typography>
                      <Typography className="public-features-card-text">
                        {feature.teaser}
                      </Typography>
                      <Box className="public-features-card-footer">
                        <Button
                          component={RouterLink}
                          to={`/funktionen/${feature.slug}`}
                          variant="contained"
                          endIcon={<ArrowForwardRoundedIcon />}
                          className="public-features-primary-button"
                        >
                          Funktionsseite ansehen
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Stack>

          <Stack spacing={2.2}>
            <Box className="public-features-docs-card">
              <Box className="public-features-docs-body">
                <Box className="public-features-doc-icon">
                  <MenuBookRoundedIcon />
                </Box>
                <Typography className="public-features-card-kicker">Dokumentation</Typography>
                <Typography component="h2" className="public-features-docs-title">
                  {currentPage.docsTitle ?? `Relevante Kapitel für ${currentPage.label}`}
                </Typography>
                <Typography className="public-features-docs-text">
                  {currentPage.docsIntro ?? 'Diese Auswahl führt direkt zu den Doku-Kapiteln, die für diese Perspektive am meisten Relevanz haben.'}
                </Typography>
                <Stack spacing={1.1} sx={{ mt: 2 }}>
                  {currentPage.docsLinks.map((entry) => (
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
                  Nächster Schritt
                </Typography>
                <Typography component="h2" className="public-features-cta-title">
                  {pageMessaging?.ctaTitle ?? 'Vom Suchthema zur echten Lösung kommen'}
                </Typography>
                <Typography className="public-features-cta-text">
                  {pageMessaging?.ctaText ?? 'Wenn diese Seite euer Thema trifft, geht es jetzt darum, die Plattform auf eure Situation zu beziehen: entweder über konkrete Doku-Kapitel oder über ein Gespräch zur Einordnung im Verein.'}
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

export default PublicIntentPage;