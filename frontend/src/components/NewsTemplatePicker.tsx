import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stack, useTheme, alpha, Chip,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { NEWS_TEMPLATES, NewsTemplate } from '../data/newsTemplates';
import RichTextContent from './RichTextContent';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the template HTML when the user confirms. */
  onApply: (html: string) => void;
  /** Whether the editor already has content (triggers a warning). */
  hasContent: boolean;
}

const NewsTemplatePicker: React.FC<Props> = ({ open, onClose, onApply, hasContent }) => {
  const theme = useTheme();
  const [selected, setSelected] = useState<NewsTemplate>(NEWS_TEMPLATES[0]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleApply = () => {
    if (hasContent) {
      setConfirmOpen(true);
    } else {
      onApply(selected.html);
      onClose();
    }
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    onApply(selected.html);
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '85vh', maxHeight: 760 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1.5 }}>
          <AutoAwesomeIcon color="primary" />
          <Box>
            <Typography variant="h6" component="span" fontWeight={700}>
              Vorlage auswählen
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Wähle eine Vorlage als Ausgangspunkt – alle Texte kannst du danach beliebig anpassen.
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent
          dividers
          sx={{ p: 0, display: 'flex', overflow: 'hidden' }}
        >
          {/* ── Left: template cards ───────────────────────────────────── */}
          <Box
            sx={{
              width: { xs: '100%', md: 280 },
              flexShrink: 0,
              borderRight: { md: `1px solid ${theme.palette.divider}` },
              overflowY: 'auto',
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {NEWS_TEMPLATES.map(tpl => {
              const isSelected = selected.id === tpl.id;
              return (
                <Box
                  key={tpl.id}
                  onClick={() => setSelected(tpl)}
                  sx={{
                    borderRadius: 2,
                    border: `2px solid ${isSelected ? tpl.color : theme.palette.divider}`,
                    bgcolor: isSelected
                      ? alpha(tpl.color, theme.palette.mode === 'dark' ? 0.15 : 0.06)
                      : 'transparent',
                    p: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: tpl.color,
                      bgcolor: alpha(tpl.color, theme.palette.mode === 'dark' ? 0.12 : 0.04),
                    },
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        bgcolor: alpha(tpl.color, 0.15),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      {tpl.icon}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        fontWeight={isSelected ? 700 : 600}
                        color={isSelected ? tpl.color : 'text.primary'}
                        noWrap
                      >
                        {tpl.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.4,
                          mt: 0.25,
                        }}
                      >
                        {tpl.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Box>

          {/* ── Right: preview panel ──────────────────────────────────────── */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: { xs: 2, sm: 3 },
              display: { xs: 'none', md: 'block' },
            }}
          >
            {/* Preview header */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
              <Chip
                label="Vorschau"
                size="small"
                sx={{
                  bgcolor: alpha(selected.color, 0.12),
                  color: selected.color,
                  fontWeight: 700,
                  border: `1px solid ${alpha(selected.color, 0.3)}`,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                So sieht die Vorlage nach dem Befüllen in etwa aus
              </Typography>
            </Stack>

            {/* Rendered preview */}
            <Box
              sx={{
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                p: { xs: 2, sm: 3 },
                bgcolor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.02)
                  : alpha(theme.palette.common.black, 0.01),
              }}
            >
              <RichTextContent html={selected.html} />
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 1.75, gap: 1 }}>
          <Button onClick={onClose} variant="outlined" color="secondary">
            Abbrechen
          </Button>
          <Button
            variant="contained"
            startIcon={<Box sx={{ fontSize: 16 }}>{selected.icon}</Box>}
            onClick={handleApply}
            sx={{ bgcolor: selected.color, '&:hover': { bgcolor: alpha(selected.color, 0.85) } }}
          >
            {selected.name} verwenden
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Overwrite confirmation ──────────────────────────────────────── */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs">
        <DialogTitle>Inhalt ersetzen?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Der aktuelle Inhalt des Editors wird durch die Vorlage <strong>„{selected.name}"</strong> ersetzt.
            Diese Aktion kann rückgängig gemacht werden (Strg+Z).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} variant="outlined" color="secondary">Abbrechen</Button>
          <Button onClick={handleConfirm} variant="contained" color="warning">
            Ersetzen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NewsTemplatePicker;
