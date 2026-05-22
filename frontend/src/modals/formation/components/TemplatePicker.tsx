import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import BaseModal from '../../BaseModal';
import { FOOTBALL_TEMPLATES, MiniField } from '../templates';
import type { FormationTemplate } from '../templates';

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: FormationTemplate) => void;
  onSkip: () => void;
}

/**
 * First step when creating a new formation.
 * Shows a grid of formation templates as selectable cards with mini-pitch previews.
 */
const TemplatePicker: React.FC<TemplatePickerProps> = ({
  open, onClose, onSelectTemplate, onSkip,
}) => (
  <BaseModal
    open={open}
    onClose={onClose}
    title="Neue Aufstellung – Formation wählen"
    maxWidth="md"
    actions={
      <Button onClick={onSkip} variant="outlined">
        Ohne Vorlage starten
      </Button>
    }
  >
    <Typography
      variant="body2"
      sx={{
        color: "text.secondary",
        mb: 3
      }}>
      Wähle eine Formation als Startpunkt. Alle Spieler sind danach frei verschiebbar
      und können mit echten Spielern aus dem Kader belegt werden.
    </Typography>

    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }
      }}>
      {FOOTBALL_TEMPLATES.map(template => (
        <Paper
          key={template.code}
          onClick={() => onSelectTemplate(template)}
          elevation={2}
          sx={{
            cursor: 'pointer',
            borderRadius: 2,
            border: '2px solid transparent',
            transition: 'all 0.15s ease',
            '&:hover': {
              borderColor: 'primary.main',
              boxShadow: 4,
              transform: 'translateY(-2px)',
            },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <MiniField players={template.players} />
          <Box sx={{ p: 1.5, textAlign: 'center' }}>
            <Typography variant="h6" sx={{
              fontWeight: 700
            }}>{template.label}</Typography>
            <Typography variant="caption" sx={{
              color: "text.secondary"
            }}>
              {template.description}
            </Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  </BaseModal>
);

export default TemplatePicker;
