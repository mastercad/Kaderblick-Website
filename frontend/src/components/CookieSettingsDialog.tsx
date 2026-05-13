import React, { useState } from 'react';
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  Stack,
  Switch,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CookieIcon from '@mui/icons-material/Cookie';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LockIcon from '@mui/icons-material/Lock';
import { Link as RouterLink } from 'react-router-dom';
import {
  COOKIE_CATEGORIES,
  type ConsentCategory,
  type CookieCategoryInfo,
} from '../services/cookieConsentService';

// ─── Kategorie-Detail-Akkordeon ──────────────────────────────────────────────

interface CategoryRowProps {
  category: CookieCategoryInfo;
  checked: boolean;
  onChange: (key: ConsentCategory, value: boolean) => void;
}

function CategoryRow({ category, checked, onChange }: CategoryRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(prev => !prev)}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          <Typography variant="subtitle2" fontWeight={600}>
            {category.label}
          </Typography>
        </Stack>

        <Box onClick={e => e.stopPropagation()}>
          {category.required ? (
            <Tooltip title="Technisch notwendig – kann nicht deaktiviert werden">
              <Stack direction="row" alignItems="center" gap={0.5}>
                <LockIcon fontSize="small" color="disabled" />
                <Typography variant="caption" color="text.secondary">
                  Immer aktiv
                </Typography>
              </Stack>
            </Tooltip>
          ) : (
            <FormControlLabel
              control={
                <Switch
                  checked={checked}
                  onChange={e => onChange(category.key, e.target.checked)}
                  size="small"
                  color="primary"
                  inputProps={{ 'aria-label': `${category.label} ${checked ? 'deaktivieren' : 'aktivieren'}` }}
                />
              }
              label=""
              sx={{ mr: 0 }}
            />
          )}
        </Box>
      </Stack>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {category.description}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            <strong>Beispiele:</strong>
            <Box component="ul" sx={{ mt: 0.5, pl: 2.5, mb: 0 }}>
              {category.examples.map(ex => (
                <li key={ex}>{ex}</li>
              ))}
            </Box>
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export interface CookieSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Wird mit der granularen Auswahl aufgerufen */
  onSave: (categories: Record<ConsentCategory, boolean>) => void;
  /** Alle Cookies akzeptieren */
  onAcceptAll: () => void;
  /** Initialer Zustand der Toggles */
  initialCategories: Record<ConsentCategory, boolean>;
}

/**
 * Granularer Cookie-Einstellungs-Dialog.
 * Kann sowohl aus dem Banner als auch aus dem Footer geöffnet werden.
 */
export default function CookieSettingsDialog({
  open,
  onClose,
  onSave,
  onAcceptAll,
  initialCategories,
}: CookieSettingsDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [categories, setCategories] = useState<Record<ConsentCategory, boolean>>(initialCategories);

  // Beim erneuten Öffnen den gespeicherten Zustand wiederherstellen
  React.useEffect(() => {
    if (open) setCategories(initialCategories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleChange = (key: ConsentCategory, value: boolean) => {
    setCategories(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({ ...categories, necessary: true });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      scroll="paper"
      aria-labelledby="cookie-settings-dialog-title"
    >
      <DialogTitle id="cookie-settings-dialog-title" sx={{ pr: 6 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <CookieIcon color="primary" />
          <span>Cookie-Einstellungen</span>
        </Stack>
        <IconButton
          aria-label="Schließen"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Hier kannst du individuell festlegen, welche Cookie-Kategorien du erlaubst. Technisch
          notwendige Cookies können nicht deaktiviert werden, da sie für den Betrieb der Webseite
          unerlässlich sind. Deine Einwilligung gilt ab dem heutigen Tag und kann jederzeit
          widerrufen werden – entweder hier oder über den Cookie-Link im Footer.
        </Typography>

        <Stack gap={1.5}>
          {COOKIE_CATEGORIES.map(cat => (
            <CategoryRow
              key={cat.key}
              category={cat}
              checked={cat.required ? true : categories[cat.key]}
              onChange={handleChange}
            />
          ))}
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Weitere Informationen findest du in unserer{' '}
          <Link component={RouterLink} to="/privacy" onClick={onClose} underline="hover">
            Datenschutzerklärung
          </Link>
          .
        </Typography>
      </DialogContent>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1}
        sx={{ px: 2, py: 1.5 }}
        justifyContent="flex-end"
      >
        <Button variant="outlined" size="small" onClick={handleSave}>
          Auswahl speichern
        </Button>
        <Button variant="contained" size="small" onClick={onAcceptAll}>
          Alle akzeptieren
        </Button>
      </Stack>
    </Dialog>
  );
}
