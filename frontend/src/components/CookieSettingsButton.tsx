import React, { useState } from 'react';
import { Button, type SxProps, type Theme } from '@mui/material';
import CookieIcon from '@mui/icons-material/Cookie';
import { useConsent } from '../context/ConsentContext';
import CookieSettingsDialog from './CookieSettingsDialog';
import { type ConsentCategory } from '../services/cookieConsentService';

/**
 * Schaltfläche, die den Cookie-Einstellungs-Dialog öffnet.
 * Für den Footer oder die Datenschutzseite gedacht.
 * Ermöglicht den gesetzlich erforderlichen Widerruf der Einwilligung.
 */
export default function CookieSettingsButton({ sx }: { sx?: SxProps<Theme> }) {
  const [open, setOpen] = useState(false);
  const { consentRecord, handleAcceptAll, handleSaveCustom } = useConsent();

  return (
    <>
      <Button
        size="small"
        variant="text"
        startIcon={<CookieIcon fontSize="small" />}
        onClick={() => setOpen(true)}
        sx={{ fontSize: 'inherit', color: 'inherit', textTransform: 'none', p: 0, minWidth: 0, ...( sx as object ?? {}) }}
      >
        Cookie-Einstellungen
      </Button>
      <CookieSettingsDialog
        open={open}
        onClose={() => setOpen(false)}
        onSave={(cats: Record<ConsentCategory, boolean>) => { handleSaveCustom(cats); setOpen(false); }}
        onAcceptAll={() => { handleAcceptAll(); setOpen(false); }}
        initialCategories={{
          necessary: true,
          functional: consentRecord?.categories.functional ?? false,
          analytics: consentRecord?.categories.analytics ?? false,
        }}
      />
    </>
  );
}
