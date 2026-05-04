import React, { useState, useEffect } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import BaseModal from '../BaseModal';
import type { ReportBuilderModalProps, ReportConfig } from './types';
import { useReportBuilder } from './useReportBuilder';
import { MobileWizard } from './MobileWizard';
import { DesktopLayout } from './DesktopLayout';
import { HelpDialog } from './HelpDialog';
import { GuidedWizard } from './GuidedWizard';
import { SaveDialog } from './SaveDialog';
import { isWizardCompatible } from './wizardLogic';

export { type Report } from './types';

type Mode = 'guided' | 'builder';

const MODAL_TITLES: Record<Mode, (editing: boolean) => string> = {
  guided:  (edit) => edit ? 'Auswertung bearbeiten' : 'Auswertung erstellen',
  builder: (edit) => edit ? 'Report bearbeiten'     : 'Manuelle Konfiguration',
};

export const ReportBuilderModal: React.FC<ReportBuilderModalProps> = ({
  open,
  onClose,
  onSave,
  report,
  initialMode,
}) => {
  const state = useReportBuilder(open, report, onSave, onClose);
  const [mode, setMode] = useState<Mode>('guided');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  // Track whether the builder config has been touched (changed from what was loaded)
  const isDirty = !!(
    state.currentReport.config.xField || state.currentReport.config.yField
  );

  // Reset to correct mode whenever the modal opens
  useEffect(() => {
    if (open) {
      if (initialMode) {
        setMode(initialMode);
      } else if (report && !isWizardCompatible(report.config)) {
        setMode('builder');
      } else {
        setMode('guided');
      }
    }
  }, [open, report, initialMode]);

  const openBuilder = (presetConfig?: Partial<ReportConfig>, presetName?: string) => {
    if (presetConfig) {
      state.setCurrentReport(prev => ({
        ...prev,
        name: presetName ?? prev.name,
        config: { ...prev.config, ...presetConfig },
      }));
    } else if (report) {
      state.setCurrentReport(report);
    }
    setMode('builder');
  };

  const handleRequestClose = () => {
    if (mode === 'builder' && isDirty) {
      setConfirmCloseOpen(true);
    } else {
      onClose();
    }
  };

  const handleSaveConfirmed = async (name: string, description: string) => {
    setSaving(true);
    try {
      await onSave({ ...state.currentReport, name, description });
      setSaveDialogOpen(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // In builder mode the Save button opens the SaveDialog instead of saving directly
  const builderCanOpenSave = !!(
    state.currentReport.config.xField && state.currentReport.config.yField
  );

  const builderActions = mode === 'builder' && !state.isMobile ? (
    <>
      <Button onClick={handleRequestClose} variant="outlined" color="secondary">
        Abbrechen
      </Button>
      <Button
        onClick={() => setSaveDialogOpen(true)}
        variant="contained"
        color="primary"
        disabled={!builderCanOpenSave}
      >
        Speichern
      </Button>
    </>
  ) : undefined;

  return (
    <>
      <BaseModal
        open={open}
        onClose={handleRequestClose}
        disableBackdropClick={mode === 'builder' && isDirty}
        maxWidth="lg"
        fullScreen={state.fullScreen}
        title={MODAL_TITLES[mode](!!report)}
        actions={builderActions}
      >
        {state.currentReport.isTemplate && !state.isAdmin && mode === 'builder' && (
          <Alert severity="info" sx={{ mb: 2, flexShrink: 0 }}>
            Du bearbeitest eine Vorlage. Deine Änderungen werden als persönliche Kopie für dich gespeichert — die Vorlage selbst bleibt unverändert.
          </Alert>
        )}

        {mode === 'guided' && (
          <GuidedWizard
            state={state}
            onSave={onSave}
            onClose={onClose}
            onOpenBuilder={openBuilder}
            onBack={onClose}
            initialConfig={report?.config}
          />
        )}

        {mode === 'builder' && (
          state.isMobile
            ? <MobileWizard state={state} onRequestSave={() => setSaveDialogOpen(true)} />
            : <DesktopLayout state={state} />
        )}

        <HelpDialog open={state.helpOpen} onClose={() => state.setHelpOpen(false)} />
      </BaseModal>

      {/* Speichern-Dialog: Name + Beschreibung erst beim Speichern abfragen */}
      <SaveDialog
        open={saveDialogOpen}
        defaultName={state.currentReport.name}
        defaultDescription={state.currentReport.description ?? ''}
        saving={saving}
        onSave={handleSaveConfirmed}
        onCancel={() => setSaveDialogOpen(false)}
      />

      {/* Schließen-Schutz: Bestätigung bei ungespeicherten Änderungen */}
      <Dialog open={confirmCloseOpen} onClose={() => setConfirmCloseOpen(false)} maxWidth="xs">
        <DialogTitle>Änderungen verwerfen?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Die Konfiguration dieser Auswertung wird nicht gespeichert. Trotzdem schließen?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCloseOpen(false)} variant="outlined" color="secondary">
            Weiterbearbeiten
          </Button>
          <Button
            onClick={() => { setConfirmCloseOpen(false); onClose(); }}
            variant="contained"
            color="error"
          >
            Verwerfen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
