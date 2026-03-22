import React, { useEffect, useRef, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Box } from '@mui/material';
import HeroSection from '../components/HeroSection';
import LandingSection from '../components/LandingSection';
import Footer from '../components/Footer';
import SectionNavigation from '../components/SectionNavigation';
import AuthModal from '../modals/AuthModal';
import { useHomeScroll } from '../context/HomeScrollContext';
import { useAuth } from '../context/AuthContext';
import calendarImage from '../../public/images/landing_page/calendar.png?url';
import surceyImage from '../../public/images/landing_page/surveys.png?url';
import coachImage from '../../public/images/landing_page/coach.png?url';
import createEventImage from '../../public/images/landing_page/create_event.png?url';
import eventZusageImage from '../../public/images/landing_page/event_zusage.png?url';
import gamesImage from '../../public/images/landing_page/game_overview.png?url';
import reportsImage from '../../public/images/landing_page/reports.png?url';
import locationNavigationLinkImage from '../../public/images/landing_page/location_navigationlink.png?url';
import newsImage from '../../public/images/landing_page/news.png?url';
import '../styles/scroll-snap.css';

// CTA-Texte für die Landing Sections
const callToActionTexts = [
  'Jetzt dabei sein',
  'Jetzt umsehen',
  'Jetzt entdecken',
  'Jetzt loslegen',
  'Jetzt ausprobieren',
  'Jetzt mitmachen',
  'Kostenlos starten',
  'Jetzt anmelden',
  'Mehr erfahren',
  'Los geht’s',
];

// Fisher-Yates Shuffle Algorithmus
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const sections = [
  {
    name: 'Events',
    image: calendarImage,
    additionalImages: [
      calendarImage,
      eventZusageImage,
      surceyImage,
      gamesImage,
      coachImage
    ],
    text: `Mit Kaderblick kannst du sämtliche Vereins-Events wie Spiele, Trainings, Treffen oder Feiern zentral planen und verwalten. Jeder Termin wird automatisch in einen übersichtlichen, modernen Kalender eingetragen, der für alle Mitglieder zugänglich ist. Trainer und Organisatoren können Events mit wenigen Klicks anlegen, bearbeiten oder absagen. Die Teilnehmer sehen auf einen Blick, was ansteht, und können sich direkt über die Plattform anmelden oder abmelden. Push-Benachrichtigungen und Erinnerungen sorgen dafür, dass niemand einen wichtigen Termin verpasst. Die Kalenderansicht ist intuitiv, filterbar nach Kategorien oder Zeiträumen und auch auf Mobilgeräten optimal nutzbar.`
  },
  {
    name: 'Event Zusagen',
    image: eventZusageImage,
    text: `Für jedes Event können Mitglieder mit nur einem Klick Zu- oder Absagen abgeben. Die Rückmeldungen sind für Trainer und Teammitglieder sofort sichtbar, sodass die Planung von Aufstellungen, Fahrgemeinschaften oder Verpflegung einfach und transparent wird. Automatische Erinnerungen helfen, die Beteiligung zu erhöhen. Die Plattform zeigt übersichtlich, wer zugesagt, abgesagt oder sich noch nicht entschieden hat – auch für wiederkehrende Termine oder Serien.`
  },
  {
    name: 'Umfragen',
    image: surceyImage,
    text: `Mit dem flexiblen Umfragesystem kannst du beliebige Feedbacks, Abstimmungen oder Meinungsbilder einholen. Erstelle eigene Fragen, Mehrfach- oder Einfachauswahl, Freitextfelder oder Bewertungsskalen. Die Umfragen lassen sich gezielt an Teams, Gruppen oder den gesamten Verein richten. Die Ergebnisse werden grafisch ausgewertet und können für spätere Analysen exportiert werden. So erhältst du wertvolle Einblicke und kannst die Vereinsarbeit gezielt verbessern.`
  },
  {
    name: 'Spielübersicht',
    image: gamesImage,
    text: `Alle Spiele werden in einer zentralen Übersicht dargestellt. Für jedes Spiel können detaillierte Ereignisse wie Tore, Karten, Auswechslungen oder besondere Momente mit Zeitstempel erfasst werden. Zusätzlich lassen sich Videos zu den Spielen hochladen und mit den jeweiligen Spielereignissen verknüpfen. So kann man später gezielt zu jedem Ereignis im Video springen und die Szene analysieren – ein wertvolles Tool für Trainer, Spieler und Fans.`
  },
  {
    name: 'Trainer',
    image: coachImage,
    text: `Trainer erhalten einen eigenen Bereich, in dem sie Spielaufstellungen planen, Taktiken hinterlegen und Notizen zu Spielern oder Gegnern erfassen können. Die Aufstellungen können per Drag & Drop erstellt und für jedes Spiel individuell angepasst werden. Taktische Varianten, Wechseloptionen und Formationen sind übersichtlich darstellbar. So wird die Spielvorbereitung digital, effizient und nachvollziehbar.`
  },
  {
    name: 'Stammdaten',
    image: createEventImage,
    text: `Die Plattform ermöglicht das Anlegen und Verwalten beliebig vieler Vereine, Teams, Spieler und Trainer. Jeder Eintrag kann mit umfangreichen Informationen, Bildern und Kontaktdaten versehen werden. Die Zuordnung zu Teams, Altersklassen oder Funktionen ist flexibel. Historien, Statistiken und individuelle Profile sorgen für Transparenz und eine optimale Organisation des Vereinslebens.`
  },
  {
    name: 'Spielstätten',
    image: locationNavigationLinkImage,
    text: `Jeder Spiel- oder Trainingsort ist mit Adresse, Karte und Link zur Navigation hinterlegt. Über einen Klick kann die Route direkt auf dem Mobilgerät in der bevorzugten Navigations-App geöffnet werden. So finden alle Teilnehmer und Eltern schnell und unkompliziert zum Austragungsort. Auch Fahrgemeinschaften lassen sich so besser organisieren.`
  },
  {
    name: 'Reports',
    image: reportsImage,
    text: `Umfangreiche Reports geben einen Überblick über Spielereignisse, Trainingsbeteiligung, Umfrageergebnisse und viele weitere Kennzahlen. Die Auswertungen sind individuell konfigurierbar, können exportiert und für Besprechungen oder die Vereinsentwicklung genutzt werden. So behältst du stets den Überblick über die Entwicklung deines Vereins und kannst gezielt Maßnahmen ableiten.`
  },
  {
    name: 'Kommunikation',
    image: newsImage,
    text: `Das interne Messaging-System ermöglicht schnelle, sichere Kommunikation zwischen allen Mitgliedern, Teams oder Funktionären. News können für die gesamte Plattform, einzelne Vereine oder Teams veröffentlicht werden. Push-Benachrichtigungen und Lesebestätigungen sorgen dafür, dass wichtige Informationen alle erreichen. So bleibt dein Verein immer bestens informiert und vernetzt.`
  },
];

export default function Home() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { setIsOnHeroSection } = useHomeScroll();
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 960px)');

  // Shuffle CTA-Texte einmalig beim Mount
  const [shuffledCtaTexts] = useState(() => shuffleArray(callToActionTexts));

  useEffect(() => {
    const original = document.body.style.background;
    document.body.style.background = 'none';

    return () => {
      document.body.style.background = original;
    };
  }, []);

  // Scroll-Tracking: isOnHeroSection für alle Viewports
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const heroSection = heroRef.current;
      if (!heroSection) return;

      const heroRect = heroSection.getBoundingClientRect();
      const isOnHero = heroRect.top >= -heroRect.height / 2 && heroRect.top <= heroRect.height / 2;
      setIsOnHeroSection(isOnHero);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [setIsOnHeroSection]);

  // Desktop: Custom Wheel-Handler für Hero → erste Sektion
  useEffect(() => {
    if (isMobile) return;
    const container = containerRef.current;
    if (!container) return;

    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout;

    const handleWheel = (e: WheelEvent) => {
      const heroSection = heroRef.current;
      if (!heroSection) return;

      const heroRect = heroSection.getBoundingClientRect();
      const isOnHero = heroRect.top >= -heroRect.height / 2 && heroRect.top <= heroRect.height / 2;

      if (isOnHero && e.deltaY > 0 && !isScrolling) {
        e.preventDefault();
        isScrolling = true;
        const firstSection = container.children[1] as HTMLElement;
        if (firstSection) {
          firstSection.scrollIntoView({ behavior: 'smooth' });
        }
        scrollTimeout = setTimeout(() => {
          isScrolling = false;
        }, 1000);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [isMobile]);

  const handleStartClick = () => {
    setAuthModalOpen(true);
  };

  const handleScrollToFirstSection = () => {
    const container = containerRef.current;
    if (!container) return;
    
    // Erste Landing Section ist das zweite Child (nach Hero)
    const firstSection = container.children[1] as HTMLElement;
    if (firstSection) {
      firstSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <Box 
        ref={containerRef}
        className="scroll-snap-container"
      >
        <HeroSection 
          onStartClick={handleStartClick} 
          heroRef={heroRef}
          onScrollDown={handleScrollToFirstSection}
        />
        
        {sections.map((section, index) => {
          const isLastSection = index === sections.length - 1;
          return (
            <Box
              key={index}
              sx={{
                height: '100dvh',
                scrollSnapAlign: 'start',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#4e4e4e',
              }}
            >
              <LandingSection
                name={section.name}
                image={section.image}
                additionalImages={section.additionalImages}
                text={section.text}
                reverse={index % 2 === 1}
                onAuthClick={!user ? () => setAuthModalOpen(true) : undefined}
                ctaText={shuffledCtaTexts[index % shuffledCtaTexts.length]}
              />
            </Box>
          );
        })}
        <Box sx={{ backgroundColor: '#4e4e4e', scrollSnapAlign: 'end', pb: { xs: user ? 'calc(56px + env(safe-area-inset-bottom, 0px))' : 0, md: 0 } }}>
          <Footer />
        </Box>
      </Box>
      
      <SectionNavigation sections={sections} containerRef={containerRef} />
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
