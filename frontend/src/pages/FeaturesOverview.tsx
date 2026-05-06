import React, { useState } from 'react';
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
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import TopicOutlinedIcon from '@mui/icons-material/TopicOutlined';
import { Link as RouterLink } from 'react-router-dom';
import DemoRequestModal from '../modals/DemoRequestModal';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import Seo from '../seo/Seo';
import { intentPages, marketingFeatures } from '../content/marketingContent';
import { DOCS_URL } from '../seo/siteConfig';
import '../styles/public-features.css';

const FeaturesOverview: React.FC = () => {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const heroPanelItems = [
    {
      title: 'Ein System statt fünf Behelfslösungen',
      text: 'Kaderblick verbindet Organisation, Kommunikation und sportliche Arbeit in einem Ablauf, statt Vereine auf Chatgruppen, Listen und Einzellösungen zu verteilen.',
      icon: TopicOutlinedIcon,
    },
    {
      title: 'Sofort sehen, wo der echte Hebel liegt',
      text: 'Interessenten erkennen hier nicht nur Funktionen, sondern welche Probleme damit konkret kleiner werden und warum das im Vereinsalltag einen Unterschied macht.',
      icon: InsightsOutlinedIcon,
    },
    {
      title: 'Erst Nutzen klären, dann Tiefe öffnen',
      text: 'Diese Seiten sollen Interesse erzeugen, weil der Mehrwert klar wird. Die Dokumentation kommt erst dann ins Spiel, wenn aus Interesse konkrete Einführung werden soll.',
      icon: MenuBookRoundedIcon,
    },
  ];

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Kaderblick Funktionen',
    itemListElement: marketingFeatures.map((feature, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: feature.name,
      url: `https://kaderblick.de/funktionen/${feature.slug}`,
    })),
  };

  return (
    <Box className="public-features">
      <Seo
        title="Funktionen für Fußballvereine | Kaderblick"
        description="Entdecke die wichtigsten Funktionen von Kaderblick für Fußballvereine: Kalender, Teilnahmen, Spielanalyse, Formationen, Kommunikation, Berichte und Vereinsorganisation."
        canonicalPath="/funktionen"
        jsonLd={itemList}
      />

      <Box component="section" className="public-features-hero">
        <Box className="public-features-hero-overlay" />

        <Container maxWidth="xl" className="public-features-shell">
          <PublicSiteHeader onOpenDemo={() => setDemoModalOpen(true)} />
          <Box className="public-features-hero-shell">
            <Box className="public-features-hero-copy">
              <Typography className="public-features-kicker">
                Öffentliche Produktseiten
              </Typography>
              <Typography component="h1" className="public-features-title">
                Funktionen für Vereine,
                <span>Trainer und Teams.</span>
              </Typography>
              <Typography className="public-features-intro">
                Kaderblick ist nicht interessant, weil es viele Funktionen gibt, sondern weil typische Reibung im Vereinsalltag endlich in einem System zusammenläuft: Planung, Rückmeldungen, Kommunikation, Vorbereitung, Analyse und Vereinsorganisation.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="public-features-action-row">
                <Button
                  component="a"
                  href="#feature-grid"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className="public-features-primary-button"
                >
                  Funktionen entdecken
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
                  <Typography className="public-features-stat-value">{marketingFeatures.length}</Typography>
                  <Typography className="public-features-stat-label">zentrale Produktbereiche für Organisation, Analyse und Kommunikation</Typography>
                </Box>
                <Box className="public-features-stat-card">
                  <Typography className="public-features-stat-value">{intentPages.length}</Typography>
                  <Typography className="public-features-stat-label">rollenbasierte Einstiege für Trainer, Eltern und Vereinsverantwortliche</Typography>
                </Box>
                <Box className="public-features-stat-card">
                  <Typography className="public-features-stat-value">Docs</Typography>
                  <Typography className="public-features-stat-label">vertiefende Kapitel, wenn du konkrete Abläufe im Detail sehen willst</Typography>
                </Box>
              </Box>
            </Box>

            <Box className="public-features-hero-panel">
              <Typography className="public-features-panel-kicker">Warum diese Seite wichtig ist</Typography>
              <Typography className="public-features-panel-title">Warum das mehr ist als eine Feature-Liste</Typography>
              <Box className="public-features-panel-list">
                {heroPanelItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Box key={item.title} className="public-features-panel-item">
                      <Box className="public-features-panel-icon">
                        <Icon />
                      </Box>
                      <Box>
                        <Typography className="public-features-panel-item-title">{item.title}</Typography>
                        <Typography className="public-features-panel-item-text">{item.text}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" className="public-features-shell public-features-main">
        <Box component="section" id="feature-grid" className="public-features-section">
          <Box className="public-features-section-head">
            <Box>
              <Typography className="public-features-section-kicker">Produktbereiche</Typography>
              <Typography component="h2" className="public-features-section-title">
                Die Produktbereiche, die im Alltag wirklich Wirkung entfalten
              </Typography>
            </Box>
            <Typography className="public-features-section-text">
              Jede Themenseite beantwortet eine kaufrelevante Frage: Welches Problem wird kleiner, warum ist das operativ wichtig und weshalb ist Kaderblick dafür die passendere Lösung als weiterer Tool-Stückwerk.
            </Typography>
          </Box>

          <Box className="public-features-grid">
            {marketingFeatures.map((feature) => (
              <Box key={feature.slug} className="public-features-card">
                <Box className="public-features-card-media">
                  <Box component="img" src={feature.image} alt={feature.name} />
                </Box>
                <Box className="public-features-card-body">
                  <Typography className="public-features-card-kicker">Funktion</Typography>
                  <Typography component="h2" className="public-features-card-title">
                    {feature.name}
                  </Typography>
                  <Typography className="public-features-card-text">
                    {feature.teaser}
                  </Typography>
                  <Box className="public-features-chip-row" sx={{ mt: 2 }}>
                    {feature.suitableFor.map((entry) => (
                      <Chip key={entry} label={entry} className="public-features-chip" />
                    ))}
                  </Box>
                  <Box className="public-features-card-footer">
                    <Button
                      component={RouterLink}
                      to={`/funktionen/${feature.slug}`}
                      variant="contained"
                      endIcon={<ArrowForwardRoundedIcon />}
                      className="public-features-primary-button"
                    >
                      Mehr erfahren
                    </Button>
                    <Typography className="public-features-link-note">
                      {feature.docsLinks.length} Doku-Links direkt verknüpft
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box component="section" className="public-features-section">
          <Box className="public-features-spotlight">
            <Box className="public-features-spotlight-copy">
              <Typography className="public-features-section-kicker">Plattformlogik</Typography>
              <Typography component="h2" className="public-features-spotlight-title">
                Erst überzeugen. Dann vertiefen.
              </Typography>
              <Typography className="public-features-spotlight-text">
                Diese Seiten sollen nicht Bedienungsanleitungen ersetzen. Sie sollen zeigen, warum Vereine, Trainer und Verantwortliche überhaupt genauer hinsehen sollten: weil Kaderblick nicht noch ein weiteres Werkzeug ist, sondern mehrere operative Baustellen in einer Plattform zusammenführt.
              </Typography>

              <Box className="public-features-spotlight-list">
                <Box className="public-features-spotlight-item">
                  <CheckCircleOutlineRoundedIcon />
                  <Typography className="public-features-card-text">Weniger austauschbare Produktfloskeln, mehr Klarheit über echten operativen Nutzen.</Typography>
                </Box>
                <Box className="public-features-spotlight-item">
                  <CheckCircleOutlineRoundedIcon />
                  <Typography className="public-features-card-text">Klarer Übergang von Interesse und Nutzenversprechen zu konkreter fachlicher Tiefe.</Typography>
                </Box>
                <Box className="public-features-spotlight-item">
                  <CheckCircleOutlineRoundedIcon />
                  <Typography className="public-features-card-text">Landingpage, Themenseiten und Doku erzählen dieselbe wertige Produktlogik statt drei verschiedene Geschichten.</Typography>
                </Box>
              </Box>
            </Box>

            <Box className="public-features-spotlight-visual">
              <Box component="img" src="/images/landing_page/game_overview.png" alt="Kaderblick Spielverwaltung und Analyse" />
            </Box>
          </Box>
        </Box>

        <Box component="section" className="public-features-section">
          <Box className="public-features-section-head">
            <Box>
              <Typography className="public-features-section-kicker">Rollenbasierte Seiten</Typography>
              <Typography component="h2" className="public-features-section-title">
                Einstiege für unterschiedliche Kauf- und Nutzungsperspektiven
              </Typography>
            </Box>
            <Typography className="public-features-section-text">
              Wer aus Trainer-, Eltern-, Leitungs- oder Analyseperspektive auf die Plattform schaut, soll sofort sehen, warum Kaderblick gerade für diese Sichtweise relevant ist und welche Bereiche dabei die größte Wirkung entfalten.
            </Typography>
          </Box>

          <Box className="public-features-intent-grid">
            {intentPages.map((page) => (
              <Box key={page.path} className="public-features-intent-card">
                <Box className="public-features-intent-body">
                  <Typography className="public-features-card-kicker">Landingpage</Typography>
                  <Typography component="h3" className="public-features-intent-title">
                    {page.label}
                  </Typography>
                  <Typography className="public-features-intent-text">
                    {page.summary}
                  </Typography>
                  <Box className="public-features-card-footer">
                    <Button
                      component={RouterLink}
                      to={page.path}
                      variant="outlined"
                      endIcon={<ArrowOutwardRoundedIcon />}
                      className="public-features-ghost-button"
                    >
                      Landingpage ansehen
                    </Button>
                    <Typography className="public-features-link-note">
                      {page.linkedFeatures.length} verknüpfte Funktionsbereiche
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box component="section" className="public-features-section">
          <Box className="public-features-cta-panel">
            <Box className="public-features-cta-body">
              <Typography className="public-features-card-kicker" sx={{ color: 'rgba(255,255,255,0.82) !important' }}>
                Nächster Schritt
              </Typography>
              <Typography component="h2" className="public-features-cta-title">
                Tiefer einsteigen oder direkt den Einsatz besprechen
              </Typography>
              <Typography className="public-features-cta-text">
                Wenn die zentrale Frage nicht mehr lautet, ob die Probleme bekannt sind, sondern ob Kaderblick sie in eurem Verein tatsächlich sauber lösen kann, sind Doku und Kontakt die nächsten sinnvollen Schritte.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.2 }}>
                <Button
                  component="a"
                  href={DOCS_URL}
                  target="_blank"
                  rel="noreferrer"
                  variant="contained"
                  endIcon={<ArrowOutwardRoundedIcon />}
                  className="public-features-ghost-button"
                >
                  Dokumentation öffnen
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
          </Box>
        </Box>
      </Container>

      <DemoRequestModal open={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
    </Box>
  );
};

export default FeaturesOverview;