import React from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import RiceBowlIcon from '@mui/icons-material/RiceBowl';
import SaladIcon from '@mui/icons-material/Dining';
import GrassIcon from '@mui/icons-material/Grass';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import PsychologyIcon from '@mui/icons-material/Psychology';
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import HealingIcon from '@mui/icons-material/Healing';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SportsIcon from '@mui/icons-material/Sports';
import Seo from '../seo/Seo';

interface TipCard {
  icon: React.ReactNode;
  title: string;
  body: string;
  bullets: string[];
  tags: { label: string; color?: 'default' | 'primary' | 'warning' | 'error' | 'info' | 'success' }[];
}

const sections: { label: string; cards: TipCard[] }[] = [
  {
    label: 'Körper & Gesundheit',
    cards: [
      {
        icon: <FlashOnIcon fontSize="large" sx={{ color: 'warning.main' }} />,
        title: 'Muskelkrämpfe – Ursachen & Soforthilfe',
        body: 'Krämpfe entstehen meist nicht zufällig. Die häufigsten Auslöser:',
        bullets: [
          'Flüssigkeitsmangel – zu wenig getrunken vor oder während des Spiels',
          'Elektrolytmangel – besonders Magnesium, Natrium und Kalium',
          'Überlastung – Muskeln die zu schnell oder zu lang belastet werden',
          'Unzureichendes Aufwärmen',
          'Schlechte Schlafqualität in den Tagen zuvor',
        ],
        tags: [
          { label: 'Prävention', color: 'success' },
          { label: 'Wichtig', color: 'warning' },
        ],
      },
      {
        icon: <WaterDropIcon fontSize="large" sx={{ color: 'info.main' }} />,
        title: 'Richtig trinken – vor, während und nach dem Spiel',
        body: 'Viele Spieler trinken erst wenn sie durstig sind – das ist zu spät. Durst bedeutet: du bist bereits leicht dehydriert.',
        bullets: [
          'Vor dem Spiel: 500 ml Wasser 2–3 Stunden vor Anpfiff',
          'Während: alle 15–20 Min. 150–200 ml, auch wenn keine Pause ist',
          'Nach dem Spiel: ca. 1,5 l pro kg verlorenem Körpergewicht',
          'Isotonische Getränke helfen bei langen Spielen, Elektrolyte zu ersetzen',
          'Kein Alkohol in den ersten Stunden nach dem Spiel – verzögert Regeneration',
        ],
        tags: [
          { label: 'Hydration', color: 'info' },
          { label: 'Alltag', color: 'default' },
        ],
      },
      {
        icon: <LocalFireDepartmentIcon fontSize="large" sx={{ color: 'error.main' }} />,
        title: 'Aufwärmen – warum es wirklich wichtig ist',
        body: 'Ein ordentliches Aufwärmen senkt das Verletzungsrisiko signifikant und verbessert die Leistung von der ersten Minute an.',
        bullets: [
          'Mindestens 10–15 Minuten vor Anpfiff',
          'Leichtes Laufen → dynamisches Dehnen → Ballarbeit',
          'Statisches Dehnen (Halten) besser nach der Einheit, nicht davor',
          'Sprints und Richtungswechsel am Ende des Aufwärmens einbauen',
          'Bei Kälte: länger aufwärmen, Muskeln brauchen mehr Zeit',
        ],
        tags: [
          { label: 'Verletzungsprävention', color: 'success' },
        ],
      },
      {
        icon: <SelfImprovementIcon fontSize="large" sx={{ color: 'secondary.main' }} />,
        title: 'Cool-down & Dehnen nach dem Spiel',
        body: 'Was nach dem Abpfiff passiert, ist genauso wichtig wie die Vorbereitung.',
        bullets: [
          '5–10 Minuten ruhiges Auslaufen (Puls langsam runter)',
          'Anschließend statische Dehnübungen: 20–30 Sek. pro Muskelgruppe halten',
          'Besonders wichtig: Oberschenkel vorne & hinten, Waden, Hüftbeuger',
          'Faszienrolle (Foam Roller) bei Verhärtungen sehr effektiv',
        ],
        tags: [
          { label: 'Regeneration', color: 'success' },
          { label: 'Alltag', color: 'default' },
        ],
      },
    ],
  },
  {
    label: 'Ernährung',
    cards: [
      {
        icon: <RiceBowlIcon fontSize="large" sx={{ color: 'warning.main' }} />,
        title: 'Was essen vor dem Spiel?',
        body: 'Die letzte große Mahlzeit sollte 3–4 Stunden vor Anpfiff stattfinden; ein kleiner Snack 1–1,5 h vorher ist okay.',
        bullets: [
          'Kohlenhydrate als Hauptquelle: Pasta, Reis, Brot',
          'Wenig Fett und Ballaststoffe direkt vor dem Spiel (liegt schwer im Magen)',
          'Kein Experiment mit neuen Lebensmitteln am Spieltag',
          'Snack 1 h vorher: Banane, Weißbrot mit Honig, Reiswaffeln',
        ],
        tags: [
          { label: 'Ernährung', color: 'warning' },
          { label: 'Spieltag', color: 'error' },
        ],
      },
      {
        icon: <SaladIcon fontSize="large" sx={{ color: 'success.main' }} />,
        title: 'Regenerationsernährung nach dem Spiel',
        body: 'Das 30–60-Minuten-Fenster nach dem Spiel ist entscheidend: Muskeln nehmen Nährstoffe dann besonders gut auf.',
        bullets: [
          'Kombination aus Kohlenhydraten + Protein (z.B. Chicken & Reis, Quark mit Früchten)',
          'Ca. 20–30 g Protein reichen aus',
          'Viel trinken – verlorene Flüssigkeit auffüllen',
          'Magnesiumreiche Lebensmittel helfen gegen Krämpfe: Nüsse, Bananen, Vollkorn',
        ],
        tags: [
          { label: 'Ernährung', color: 'warning' },
          { label: 'Regeneration', color: 'success' },
        ],
      },
      {
        icon: <GrassIcon fontSize="large" sx={{ color: 'primary.main' }} />,
        title: 'Ernährung im Alltag – Grundlagen',
        body: 'Leistung wird nicht nur am Spieltag gemacht – was du die ganze Woche isst, bestimmt wie fit du wirklich bist.',
        bullets: [
          'Viel Gemüse und Obst: Vitamine, Antioxidantien, Mikronährstoffe',
          'Ausreichend Protein für Muskelaufbau und -erhalt (1,4–1,7 g/kg Körpergewicht)',
          'Magnesium & Kalium: wichtig für Muskel- und Nervenfunktion',
          'Zuckerreiche Getränke (Cola, Energy Drinks) liefern leere Kalorien',
          'Nichts ändert sich über Nacht – aber Konstanz macht den Unterschied',
        ],
        tags: [
          { label: 'Ernährung', color: 'warning' },
          { label: 'Alltag', color: 'default' },
        ],
      },
    ],
  },
  {
    label: 'Schlaf & Mentales',
    cards: [
      {
        icon: <BedtimeIcon fontSize="large" sx={{ color: 'primary.dark' }} />,
        title: 'Schlaf – der unterschätzte Leistungsfaktor',
        body: 'Kein Supplement, kein Training ersetzt guten Schlaf. Während du schläfst regenerieren Muskeln und Hormone werden ausgeschüttet.',
        bullets: [
          '7–9 Stunden pro Nacht für Jugendliche und junge Erwachsene',
          'Regelmäßige Schlafzeiten – auch am Wochenende',
          'Kein Bildschirm 30–60 Min. vor dem Schlafen (blaues Licht stört Melatonin)',
          'Kühles, dunkles Zimmer hilft beim Einschlafen',
          'Schlechter Schlaf vor einem Spiel? Lieber 20 Min. Power-Nap als nichts',
        ],
        tags: [
          { label: 'Regeneration', color: 'success' },
          { label: 'Wichtig', color: 'warning' },
        ],
      },
      {
        icon: <PsychologyIcon fontSize="large" sx={{ color: 'info.main' }} />,
        title: 'Nervosität vor dem Spiel – normal und nutzbar',
        body: 'Jeder Spieler kennt das Kribbeln vor dem Anpfiff. Das ist kein Problem – es ist Energie die du nutzen kannst.',
        bullets: [
          'Atemübung: 4 Sek. einatmen, 6 Sek. ausatmen – beruhigt das Nervensystem',
          'Routine hilft: immer gleiche Vorbereitung schafft Sicherheit',
          'Musik hören die dich in den richtigen Zustand bringt',
          'Fokus auf das was du tun kannst – nicht auf Ergebnisse oder Fehler die noch gar nicht passiert sind',
          'Negative Selbstgespräche bewusst unterbrechen',
        ],
        tags: [
          { label: 'Mentalität', color: 'info' },
          { label: 'Tipp', color: 'default' },
        ],
      },
      {
        icon: <EmojiObjectsIcon fontSize="large" sx={{ color: 'warning.main' }} />,
        title: 'Mit Fehlern umgehen – auf dem Platz und danach',
        body: 'Fehler gehören zum Fußball. Wer nach einem Fehler noch lange grübelt, verliert den Anschluss ans Spiel.',
        bullets: [
          '3-Sekunden-Regel: kurz ärgern, dann abschütteln und weiter',
          'Fehler nach dem Spiel analysieren – nicht während',
          'Niemand spielt perfekt – auch Profis nicht',
          'Offen für Feedback vom Trainer sein, ohne sich zu verlieren',
          'Konstanz schlägt Perfektion: regelmäßig gut sein ist wertvoller als einmal perfekt',
        ],
        tags: [
          { label: 'Mentalität', color: 'info' },
        ],
      },
    ],
  },
  {
    label: 'Verletzungen & Belastung',
    cards: [
      {
        icon: <HealingIcon fontSize="large" sx={{ color: 'error.main' }} />,
        title: 'Kleine Verletzungen – wann Pause, wann weitermachen?',
        body: 'Die PECH-Regel ist ein bewährter Erste-Hilfe-Standard im Sport:',
        bullets: [
          'Pause – Belastung sofort stoppen',
          'Eis – kühlen (nie direkt auf die Haut, immer mit Tuch)',
          'Compression – leichter Druckverband bei Schwellungen',
          'Hochlagerung – betroffene Stelle hochlagern',
          'Schmerzen die nach 2–3 Tagen nicht besser werden: zum Arzt',
        ],
        tags: [
          { label: 'Erste Hilfe', color: 'error' },
          { label: 'Verletzung', color: 'warning' },
        ],
      },
      {
        icon: <TrendingDownIcon fontSize="large" sx={{ color: 'warning.main' }} />,
        title: 'Übertraining erkennen und vermeiden',
        body: 'Mehr Training ist nicht automatisch besser. Der Körper braucht Reiz und Erholung um sich zu verbessern.',
        bullets: [
          'Zeichen von Übertraining: anhaltende Müdigkeit, Leistungsabfall, Schlafstörungen, schlechte Laune',
          'Mindestens 1–2 Ruhetage pro Woche einplanen',
          'Intensität und Umfang nicht gleichzeitig erhöhen',
          'Auf den eigenen Körper hören: ein Trainingstag weniger schadet selten',
        ],
        tags: [
          { label: 'Planung', color: 'default' },
          { label: 'Achtung', color: 'warning' },
        ],
      },
      {
        icon: <SportsIcon fontSize="large" sx={{ color: 'primary.main' }} />,
        title: 'Ausrüstung – nicht unterschätzen',
        body: 'Falsches oder abgenutztes Equipment erhöht das Verletzungsrisiko und senkt die Leistung.',
        bullets: [
          'Stollenlänge und -typ an den Untergrund anpassen (kurze Noppen bei Kunstrasen)',
          'Fußballschuhe sollten eng anliegen aber nicht drücken',
          'Schienbeinschoner schützen – auch im Training',
          'Kompressionssocken können bei der Regeneration helfen',
          'Ausrüstung regelmäßig prüfen – ausgelatschte Sohlen nehmen Stabilität',
        ],
        tags: [
          { label: 'Ausrüstung', color: 'info' },
        ],
      },
    ],
  },
];

const PlayerTips: React.FC = () => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Tipps & Tricks fuer Fussballspieler',
    description: 'Praktische Gesundheits- und Fitnesstipps fuer Fussballspieler: Muskelkraempfe vermeiden, richtig hydratisieren, Aufwaermen, Ernaehrung und Regeneration.',
    author: { '@type': 'Organization', name: 'Kaderblick' },
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Seo
        title="Tipps fuer Spieler – Muskelkraempfe, Ernaehrung, Schlaf | Kaderblick"
        description="Praktische Gesundheits- und Fitnesstipps fuer Fussballspieler: Muskelkraempfe vermeiden, richtig hydratisieren, Aufwaermen, Ernaehrung und Regeneration."
        canonicalPath="/player-tips"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <Stack spacing={2} sx={{ mb: 5 }}>
        <Typography variant="overline" sx={{ letterSpacing: 2.1, color: 'primary.main', fontWeight: 700 }}>
          Wissen für den Platz
        </Typography>
        <Typography component="h1" variant="h2" sx={{ fontWeight: 800 }}>
          Tipps &amp; Tricks für Spieler
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760, fontSize: '1.05rem', lineHeight: 1.8 }}>
          Alltägliche Situationen im Fußball besser verstehen – von Muskelkrämpfen über Schlaf bis hin zu richtiger Ernährung.
          Kein Ersatz für medizinischen Rat, aber nützliches Grundwissen das dir auf und neben dem Platz hilft.
        </Typography>
        <Alert severity="info" sx={{ maxWidth: 760 }}>
          Diese Seite enthält allgemeine Sport- und Gesundheitsinformationen. Sie ersetzt keine ärztliche Diagnose oder
          Behandlung. Bei anhaltenden Beschwerden immer einen Arzt aufsuchen.
        </Alert>
      </Stack>

      {/* Sections */}
      {sections.map((section) => (
        <Box key={section.label} sx={{ mb: 6 }}>
          <Typography
            variant="overline"
            sx={{ letterSpacing: 2, color: 'text.secondary', fontWeight: 700, display: 'block', mb: 2 }}
          >
            {section.label}
          </Typography>
          <Grid container spacing={3}>
            {section.cards.map((card) => (
              <Grid key={card.title} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: 4 },
                  }}
                >
                  <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box>{card.icon}</Box>
                    <Typography component="h2" variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                      {card.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.body}
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}>
                      {card.bullets.map((b) => (
                        <Box component="li" key={b} sx={{ mb: 0.5 }}>
                          <Typography variant="body2">{b}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={{ mt: 'auto', pt: 1.5 }}>
                      {card.tags.map((tag) => (
                        <Chip
                          key={tag.label}
                          label={tag.label}
                          size="small"
                          color={tag.color ?? 'default'}
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Container>
  );
};

export default PlayerTips;
