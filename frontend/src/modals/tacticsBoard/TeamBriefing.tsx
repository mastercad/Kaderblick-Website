import React, { useState, useCallback } from 'react';
import { Box, Button, Typography } from '@mui/material';
import WhatshotIcon from '@mui/icons-material/Whatshot';

// ─── Content ───────────────────────────────────────────────────────────────────

const TEAM_REMINDERS = [
  { icon: '👁️', text: 'Schulterblick! Umgebung scannen bevor der Ball kommt.' },
  { icon: '🗣️', text: 'Redet miteinander – laut, klar, konsequent.' },
  { icon: '⚠️', text: 'Gegner nähert sich? Sofort ansagen!' },
  { icon: '🧤', text: 'Torwart: Du siehst das ganze Spiel. Triff Anweisungen – immer!' },
  { icon: '⚡', text: 'Früh pressen. Kein Raum, kein Atem für den Gegner.' },
  { icon: '🛡️', text: 'Zweikampf konsequent zu Ende führen – nicht halbherzig.' },
  { icon: '🔗', text: 'Kompakt bleiben. Abstände halten. Als Einheit agieren.' },
] as const;

const MOTIVATION_QUOTES = [
  'Wer heute alles gibt, muss sich morgen nichts vorwerfen.',
  'Zweimal Meister. Zweimal Pokalsieger. Kein Zufall – das ist Charakter.',
  'Spielt für den Mann neben euch. Der Rest kommt von selbst.',
  'Siege entstehen in den Momenten, in denen keiner mehr kann – und ihr trotzdem weitermacht.',
  'Ihr habt diese Liga zwei Saisons lang dominiert. Heute macht ihr weiter.',
  'Kein Gegner hat euch gestoppt. Der heute auch nicht.',
  'Vertraut einander. Kämpft füreinander. Gewinnt miteinander.',
  'Das Spielfeld zeigt, wer ihr wirklich seid. Zeigt es.',
  'Raus auf den Platz und holt, was euch gehört.',
  'Heute kein Halbgas. Heute alles.',
  'Ein Team, ein Ziel, ein unbändiger Wille. Das ist euer Rezept.',
  'Ein Spiel dauert 90 Minuten. Ihr habt 90 Chancen, alles zu geben. Nutzt sie.',
  'Einer für alle, alle für einen. Das ist euer Motto. Lebt es heute mehr denn je.',
] as const;

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders the subtle „Team-Briefing" trigger button and the full-screen
 * motivational overlay. Position it as `position: absolute, inset: 0,
 * pointerEvents: none` inside the presentation-mode container; interactive
 * parts opt back in via `pointerEvents: auto`.
 */
interface TeamBriefingProps {
  onLosgehts?: () => void;
}

export const TeamBriefing: React.FC<TeamBriefingProps> = ({ onLosgehts }) => {
  const [open, setOpen] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);

  const handleOpen = useCallback(() => {
    setQuoteIdx(Math.floor(Math.random() * MOTIVATION_QUOTES.length));
    setOpen(true);
  }, []);

  return (
    <Box sx={{ position: 'absolute', inset: 0, zIndex: 200, pointerEvents: 'none' }}>
      {/* Trigger button – bottom centre */}
      {!open && (
        <Box
          role="button"
          aria-label="Team-Briefing öffnen"
          onClick={handleOpen}
          sx={{
            position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 0.75,
            px: 2, py: 0.75, borderRadius: 3,
            bgcolor: 'rgba(255,214,0,0.07)', border: '1px solid rgba(255,214,0,0.22)',
            cursor: 'pointer', opacity: 0.38,
            '&:hover': { opacity: 1, bgcolor: 'rgba(255,214,0,0.14)' },
            transition: 'opacity 0.2s, background 0.2s',
          }}
        >
          <WhatshotIcon sx={{ fontSize: 15, color: '#ffd600' }} />
          <Typography variant="caption" sx={{ color: '#ffd600', fontWeight: 700, fontSize: '0.7rem', userSelect: 'none' }}>
            Team-Briefing
          </Typography>
        </Box>
      )}

      {/* Full-screen overlay */}
      {open && (
        <Box
          sx={{
            position: 'absolute', inset: 0,
            pointerEvents: 'auto',
            bgcolor: 'rgba(4,9,4,0.97)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            p: { xs: 3, md: 7 }, overflowY: 'auto',
            animation: 'tbSlideUp 0.32s cubic-bezier(0.4,0,0.2,1)',
            '@keyframes tbSlideUp': {
              from: { transform: 'translateY(36px)', opacity: 0 },
              to:   { transform: 'translateY(0)',    opacity: 1 },
            },
          }}
        >
          <Typography sx={{ color: '#ffd600', fontWeight: 900, letterSpacing: 6, fontSize: { xs: '0.6rem', md: '0.75rem' }, mb: 0.75, textAlign: 'center', textTransform: 'uppercase' }}>
            Vor dem Anpfiff
          </Typography>
          <Typography sx={{ color: 'white', fontWeight: 800, fontSize: { xs: '1.35rem', md: '1.9rem' }, mb: { xs: 3, md: 4.5 }, textAlign: 'center', lineHeight: 1.2 }}>
            Fokus. Wille. Vollgas.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.25, md: 1.75 }, mb: { xs: 3, md: 4.5 }, width: '100%', maxWidth: 660 }}>
            {TEAM_REMINDERS.map((r, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
                <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.35rem' }, lineHeight: 1.4, flexShrink: 0, mt: '1px' }}>{r.icon}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.92)', fontWeight: 600, fontSize: { xs: '0.88rem', md: '1.05rem' }, lineHeight: 1.45 }}>
                  {r.text}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ width: '100%', maxWidth: 660, height: '1px', bgcolor: 'rgba(255,214,0,0.25)', mb: { xs: 3, md: 4 } }} />

          <Box sx={{ maxWidth: 620, textAlign: 'center', mb: { xs: 4, md: 5 } }}>
            <Typography sx={{ color: '#ffd600', fontWeight: 800, fontSize: { xs: '1.1rem', md: '1.5rem' }, lineHeight: 1.55, fontStyle: 'italic', letterSpacing: 0.2 }}>
              „{MOTIVATION_QUOTES[quoteIdx]}"
            </Typography>
          </Box>

          <Button
            onClick={() => { setOpen(false); onLosgehts?.(); }}
            variant="contained"
            size="large"
            startIcon={<WhatshotIcon />}
            sx={{
              textTransform: 'none', fontWeight: 900,
              fontSize: { xs: '0.95rem', md: '1.1rem' },
              px: { xs: 4, md: 6 }, py: { xs: 1.25, md: 1.6 },
              borderRadius: 3,
              bgcolor: '#ffd600', color: '#0a0f0a',
              boxShadow: '0 0 40px rgba(255,214,0,0.3)',
              '&:hover': { bgcolor: '#ffe033', boxShadow: '0 0 56px rgba(255,214,0,0.45)' },
              transition: 'box-shadow 0.2s, background 0.15s',
            }}
          >
            Los geht&apos;s! ⚡
          </Button>
        </Box>
      )}
    </Box>
  );
};
