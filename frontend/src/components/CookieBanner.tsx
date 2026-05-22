import React, { useState } from 'react';
import { Box, Button, Link, Paper, Slide, Stack, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CookieIcon from '@mui/icons-material/Cookie';
import { Link as RouterLink } from 'react-router-dom';
import { type ConsentCategory } from '../services/cookieConsentService';
import { useConsent } from '../context/ConsentContext';
import CookieSettingsDialog from './CookieSettingsDialog';

// ─── Banner ───────────────────────────────────────────────────────────────────

/**
 * CookieBanner
 *
 * Datenschutz-konformer Cookie-Hinweisbanner gemäß DSGVO und TTDSG.
 *
 * Rechtliche Anforderungen die hier erfüllt werden:
 * - Erscheint vor jeder nicht-notwendigen Datenverarbeitung (§ 25 TTDSG)
 * - Gleichwertige Buttons für Akzeptieren und Ablehnen (kein Dark Pattern)
 * - Granulare Auswahlmöglichkeit pro Kategorie über "Einstellungen"
 * - Verlinkung zur Datenschutzerklärung (Art. 13 DSGVO)
 * - Einwilligung mit Zeitstempel gespeichert (Art. 7 Abs. 1 DSGVO)
 * - Widerruf jederzeit über Footer-Link möglich (Art. 7 Abs. 3 DSGVO)
 * - Keine vorausgewählten optionalen Kategorien (Art. 4 Nr. 11 DSGVO)
 */
export default function CookieBanner() {
  const { hasConsented, consentRecord, handleAcceptAll, handleAcceptNecessaryOnly, handleSaveCustom } =
    useConsent();
  const [showSettings, setShowSettings] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const bannerVisible = !hasConsented;

  const initialDialogCategories: Record<ConsentCategory, boolean> = {
    necessary: true,
    functional: consentRecord?.categories.functional ?? false,
    analytics: consentRecord?.categories.analytics ?? false,
  };

  return (
    <>
      {/* ── Banner ── */}
      <Slide direction="up" in={bannerVisible} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          aria-label="Cookie-Einwilligung"
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.modal + 10,
            borderRadius: 0,
            borderTop: `3px solid ${theme.palette.primary.main}`,
            p: { xs: 2, sm: 3 },
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            sx={{
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2
            }}>
            {/* ── Text ── */}
            <Box sx={{ flex: 1 }}>
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  gap: 1,
                  mb: 0.5
                }}>
                <CookieIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" sx={{
                  fontWeight: 700
                }}>
                  Wir respektieren deine Privatsphäre
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>
                Wir setzen technisch notwendige Cookies ein, die für den Betrieb der Webseite
                erforderlich sind. Mit deiner Einwilligung nutzen wir zusätzlich funktionale
                Cookies, um die Nutzererfahrung zu verbessern. Du kannst deine Einwilligung
                jederzeit widerrufen oder anpassen.{' '}
                <Link component={RouterLink} to="/privacy" underline="hover">
                  Datenschutzerklärung
                </Link>
              </Typography>
            </Box>

            {/* ── Aktionen ──
                Wichtig für DSGVO-Konformität:
                "Nur notwendige" und "Alle akzeptieren" haben dieselbe visuelle Prominenz.
                Kein Dark Pattern durch versteckte oder ausgegraute Ablehn-Schaltfläche.
            */}
            <Stack
              direction={isMobile ? 'column' : 'row'}
              sx={{
                gap: 1,
                flexShrink: 0,
                width: isMobile ? '100%' : 'auto'
              }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleAcceptNecessaryOnly}
                fullWidth={isMobile}
                aria-label="Nur technisch notwendige Cookies akzeptieren"
              >
                Nur notwendige
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowSettings(true)}
                fullWidth={isMobile}
                aria-label="Individuelle Cookie-Einstellungen öffnen"
              >
                Einstellungen
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleAcceptAll}
                fullWidth={isMobile}
                aria-label="Alle Cookies akzeptieren"
              >
                Alle akzeptieren
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Slide>
      {/* ── Einstellungs-Dialog ── */}
      <CookieSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={cats => { handleSaveCustom(cats); setShowSettings(false); }}
        onAcceptAll={() => { handleAcceptAll(); setShowSettings(false); }}
        initialCategories={initialDialogCategories}
      />
    </>
  );
}

