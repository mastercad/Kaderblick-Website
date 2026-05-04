import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Divider,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TuneIcon from '@mui/icons-material/Tune';
import type { Report, ReportConfig, BuilderData } from './types';
import { TemplateGrid, type ResolvedTemplate } from './TemplateGrid';



export interface StartScreenProps {
  builderData: BuilderData | null;
  onSave: (report: Report) => Promise<void>;
  onClose: () => void;
  onOpenWizard: () => void;
  /** Optionally pre-fills the builder with a preset config before opening it */
  onOpenBuilder: (presetConfig?: Partial<ReportConfig>, presetName?: string) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  builderData,
  onSave,
  onClose,
  onOpenWizard,
  onOpenBuilder,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ResolvedTemplate | null>(null);
  const [reportName, setReportName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveSelected = async () => {
    if (!selectedTemplate || !reportName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: reportName.trim(),
        description: '',
        config: selectedTemplate.resolvedConfig,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBuilderWithPreset = () => {
    if (selectedTemplate) {
      onOpenBuilder(selectedTemplate.resolvedConfig, reportName || selectedTemplate.title);
    } else {
      onOpenBuilder();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Welche Auswertung interessiert dich?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Wähle eine fertige Vorlage — oder erstelle Schritt für Schritt deine eigene.
        </Typography>
      </Box>

      {/* Template grid with built-in category filter */}
      <TemplateGrid
        builderData={builderData}
        selectedKey={selectedTemplate?.key}
        onSelect={(tpl) => {
          setSelectedTemplate(tpl);
          setReportName(tpl.title);
        }}
        onCategoryChange={() => setSelectedTemplate(null)}
        maxHeight="none"
      />

      {/* Confirmation bar — sticky at the bottom when a template is selected */}
      {selectedTemplate && (
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'primary.main',
            pt: 1.5,
            pb: { xs: 1, sm: 1.5 },
            zIndex: 10,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {selectedTemplate.emoji}&nbsp;{selectedTemplate.title} — Gib dieser Auswertung einen Namen:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              placeholder="Name für diese Auswertung"
              sx={{ flexGrow: 1, minWidth: 160 }}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && reportName.trim()) handleSaveSelected();
              }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleOpenBuilderWithPreset}
              startIcon={<TuneIcon fontSize="small" />}
            >
              Anpassen
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSaveSelected}
              disabled={!reportName.trim() || saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              Speichern
            </Button>
          </Box>
        </Box>
      )}

      <Divider />

      {/* Alternative entry points */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Nicht das Richtige dabei?
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoFixHighIcon fontSize="small" />}
          onClick={onOpenWizard}
        >
          Schritt für Schritt erstellen
        </Button>
        <Button
          variant="text"
          size="small"
          startIcon={<TuneIcon fontSize="small" />}
          onClick={() => onOpenBuilder()}
          sx={{ color: 'text.secondary', fontSize: '0.8rem' }}
        >
          Manuell konfigurieren
        </Button>
      </Box>
    </Box>
  );
};
