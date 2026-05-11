import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ChecklistRtlOutlinedIcon from '@mui/icons-material/ChecklistRtlOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import { Link as RouterLink } from 'react-router-dom';
import AuthModal from '../modals/AuthModal';
import DemoRequestModal from '../modals/DemoRequestModal';
import PublicSiteHeader from '../components/public/PublicSiteHeader';
import { useHomeScroll } from '../context/HomeScrollContext';
import Seo from '../seo/Seo';
import '../styles/public-home.css';

const heroHighlights = [
  {
    title: 'Einfach zu bedienen',
    text: 'Intuitiv & schnell startklar',
  },
  {
    title: 'Alles an einem Ort',
    text: 'Organisation leicht gemacht',
  },
  {
    title: 'Für alle Vereinsgrößen',
    text: 'Von Jugend bis Profis',
  },
];

const featureCards = [
  {
    title: 'Events & Vereinskalender',
    text: 'Trainings, Spiele und Termine im Blick.',
    icon: CalendarMonthOutlinedIcon,
  },
  {
    title: 'Teilnahmen & Zusagen',
    text: 'Zusageprozesse einfach verwalten und behalten.',
    icon: ChecklistRtlOutlinedIcon,
  },
  {
    title: 'Umfragen & Feedback',
    text: 'Mehr Meinung einholen, bessere Entscheidungen treffen.',
    icon: ForumOutlinedIcon,
  },
  {
    title: 'Spielverwaltung & Analyse',
    text: 'Ergebnisse, Statistiken und Entwicklungen verstehen.',
    icon: QueryStatsOutlinedIcon,
  },
  {
    title: 'Trainer-Tools & Formationen',
    text: 'Taktiken planen, Formationen erstellen und teilen.',
    icon: AccountTreeOutlinedIcon,
  },
  {
    title: 'Vereins- & Stammdaten',
    text: 'Mitglieder, Teams und Funktionen zentral verwalten.',
    icon: BadgeOutlinedIcon,
  },
];

const benefitCards = [
  {
    title: 'Bessere Kommunikation',
    text: 'Informationen, Updates und Entscheidungen erreichen alle Beteiligten schnell und zuverlässig.',
    icon: CampaignOutlinedIcon,
  },
  {
    title: 'Sicher & DSGVO-konform',
    text: 'Deutsche Server, moderne Sicherheitsstandards und Datenschutz nach DSGVO - für maximale Sicherheit.',
    icon: ShieldOutlinedIcon,
  },
  {
    title: 'Weniger Aufwand, mehr Zeit',
    text: 'Routineaufgaben automatisieren und administrative Arbeit spürbar reduzieren.',
    icon: AccessTimeOutlinedIcon,
  },
];

export default function Home() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { setIsOnHeroSection } = useHomeScroll();

  useEffect(() => {
    const original = document.body.style.background;
    document.body.style.background = '#ffffff';

    const updateHeroState = () => {
      const hero = heroRef.current;
      if (!hero) {
        setIsOnHeroSection(true);

        return;
      }

      const rect = hero.getBoundingClientRect();
      const visibleThreshold = window.innerHeight * 0.35;
      setIsOnHeroSection(rect.bottom > visibleThreshold);
    };

    updateHeroState();
    window.addEventListener('scroll', updateHeroState, { passive: true });
    window.addEventListener('resize', updateHeroState);

    return () => {
      document.body.style.background = original;
      window.removeEventListener('scroll', updateHeroState);
      window.removeEventListener('resize', updateHeroState);
    };
  }, [setIsOnHeroSection]);

  return (
    <>
      <Seo
        title="Kaderblick - Vereinssoftware für Fußballvereine, Trainer und Teams"
        description="Digitale Vereinssoftware für Fußballvereine mit Kalender, Spielanalyse, Formationen, Kommunikation, News, Berichten und Vereinsorganisation in einer Plattform."
        canonicalPath="/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Kaderblick',
            url: 'https://kaderblick.de/',
            logo: 'https://kaderblick.de/images/kaderblick_website_appicon.png',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Kaderblick',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '10',
              priceCurrency: 'EUR',
              priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: '10',
                priceCurrency: 'EUR',
                unitText: 'MON',
              },
            },
            description: 'Vereinssoftware für Fußballvereine mit Kalender, Trainingsorganisation, Spielanalyse, Kommunikation und Berichten.',
            url: 'https://kaderblick.de/',
          },
        ]}
      />

      <Box className="public-home">
        <Box ref={heroRef} component="section" className="public-home-hero">
          <Box className="public-home-hero-overlay" />

          <Container maxWidth="xl" className="public-home-shell">
            <PublicSiteHeader onOpenAuth={() => setAuthModalOpen(true)} onOpenDemo={() => setDemoModalOpen(true)} />

            <Box className="public-home-hero-content">
              <Box className="public-home-hero-copy">
                <Typography component="h1" className="public-home-hero-title">
                  Die Software für
                  <span>Fußballvereine</span>
                </Typography>

                <Typography className="public-home-hero-text">
                  Kaderblick hilft Vereinen, Trainern, Eltern und Jugendleitungen,
                  das Vereinsleben effizient zu organisieren - alles an einem Ort.
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="public-home-hero-actions">
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardRoundedIcon />}
                    className="public-home-demo-button public-home-demo-button-large"
                    onClick={() => setDemoModalOpen(true)}
                  >
                    Demo anfragen
                  </Button>
                  <Button
                    variant="outlined"
                    endIcon={<ArrowForwardRoundedIcon />}
                    className="public-home-more-button"
                    component="a"
                    href="/funktionen"
                  >
                    Mehr erfahren
                  </Button>
                </Stack>

                <Box className="public-home-highlight-row">
                  {heroHighlights.map((highlight) => (
                    <Box key={highlight.title} className="public-home-highlight-item">
                      <Box className="public-home-highlight-icon">
                        <CheckCircleOutlineRoundedIcon />
                      </Box>
                      <Box>
                        <Typography className="public-home-highlight-title">{highlight.title}</Typography>
                        <Typography className="public-home-highlight-text">{highlight.text}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Container>
        </Box>

        <Box component="section" id="funktionen" className="public-home-feature-band">
          <Container maxWidth="xl" className="public-home-feature-grid">
            {featureCards.map((feature) => {
              const Icon = feature.icon;

              return (
                <Box key={feature.title} className="public-home-feature-card">
                  <Box className="public-home-feature-icon-wrap">
                    <Icon className="public-home-feature-icon" />
                  </Box>
                  <Box>
                    <Typography className="public-home-feature-title">
                      {feature.title}
                    </Typography>
                    <Typography className="public-home-feature-text">
                      {feature.text}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Container>
        </Box>

        <Box component="section" id="vorteile" className="public-home-showcase-section">
          <Container maxWidth="xl">
            <Box className="public-home-showcase-grid">
              <Box className="public-home-copy-column">
                <Typography className="public-home-kicker">
                  Alles im Blick
                </Typography>
                <Typography component="h2" className="public-home-section-title">
                  Vereinsarbeit
                  <br />
                  leicht gemacht.
                </Typography>
                <Typography className="public-home-section-text">
                  Kaderblick digitalisiert und vereinfacht alle Prozesse rund um Training,
                  Spielbetrieb und Kommunikation - für mehr Zeit für das, was wirklich zählt: Fußball.
                </Typography>
                <Button
                  component={RouterLink}
                  to="/funktionen"
                  variant="contained"
                  endIcon={<ArrowOutwardRoundedIcon />}
                  className="public-home-primary-button"
                >
                  Mehr über Kaderblick
                </Button>
              </Box>

              <Box className="public-home-device-stage" id="ueber-uns">
                <Box className="public-home-device-backdrop" />
                <Box
                  component="img"
                  src="/images/landing_page/screenshare_layout_1778064884030.png"
                  alt="Kaderblick Oberfläche als Platzhalter"
                  className="public-home-showcase-image"
                  loading="lazy"
                />
              </Box>

              <Stack className="public-home-benefits-column">
                {benefitCards.map((benefit) => {
                  const Icon = benefit.icon;

                  return (
                    <Box key={benefit.title} className="public-home-benefit-item">
                      <Box className="public-home-benefit-icon-wrap">
                        <Icon className="public-home-benefit-icon" />
                      </Box>
                      <Box>
                        <Typography className="public-home-benefit-title">
                          {benefit.title}
                        </Typography>
                        <Typography className="public-home-benefit-text">
                          {benefit.text}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </Container>
        </Box>

        <Box component="footer" id="cta" className="public-home-proof-section">
          <Container maxWidth="lg" className="public-home-proof-grid">
            <Box className="public-home-proof-copy">
              <Box className="public-home-proof-icon-wrap">
                <CalendarMonthOutlinedIcon />
              </Box>
              <Box>
                <Typography className="public-home-proof-title">
                  Bereit, deinen Verein auf das nächste Level zu bringen?
                </Typography>
                {/*
                <Typography className="public-home-proof-text">
                  Über 1.000 Vereine vertrauen bereits auf Kaderblick.
                </Typography>
                */}
                <Stack direction="row" spacing={2.5} className="public-home-proof-legal">
                  <Link component={RouterLink} to="/kontakt" className="public-home-proof-link" underline="none">
                    Kontakt
                  </Link>
                  <Link component={RouterLink} to="/imprint" className="public-home-proof-link" underline="none">
                    Impressum
                  </Link>
                  <Link component={RouterLink} to="/privacy" className="public-home-proof-link" underline="none">
                    Datenschutz
                  </Link>
                </Stack>
              </Box>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} className="public-home-proof-actions">
              <Button
                variant="contained"
                endIcon={<ArrowOutwardRoundedIcon />}
                className="public-home-cta-button-light"
                onClick={() => setDemoModalOpen(true)}
              >
                Demo anfragen
              </Button>
              <Button
                component="a"
                href="/funktionen"
                variant="outlined"
                endIcon={<ArrowOutwardRoundedIcon />}
                className="public-home-cta-button-ghost"
              >
                Mehr erfahren
              </Button>
            </Stack>
          </Container>
        </Box>
      </Box>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <DemoRequestModal open={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
    </>
  );
}
