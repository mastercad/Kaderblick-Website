import React, { useState, useEffect } from 'react';
import { Alert, Button } from '@mui/material';
import BaseModal from '../BaseModal';
import type { ReportBuilderModalProps, ReportConfig } from './types';
import { useReportBuilder } from './useReportBuilder';
import { MobileWizard } from './MobileWizard';
import { DesktopLayout } from './DesktopLayout';
import { HelpDialog } from './HelpDialog';
import { GuidedWizard } from './GuidedWizard';
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
}) => {
  const state = useReportBuilder(open, report, onSave, onClose);
  const [mode, setMode] = useState<Mode>('guided');

  // Reset to correct mode whenever the modal opens
  useEffect(() => {
    if (open) {
      if (report && !isWizardCompatible(report.config)) setMode('builder');
      else setMode('guided');
    }
  }, [open, report]);

  const openBuilder = (presetConfig?: Partial<ReportConfig>, presetName?: string) => {
    if (presetConfig) {
      state.setCurrentReport(prev => ({
        ...prev,
        name: presetName ?? prev.name,
        config: { ...prev.config, ...presetConfig },
      }));
    } else if (report) {
      // Switching from the guided wizard to the full builder without a preset:
      // always restore the original saved report so that ALL filters (team,
      // player, date range, gameType, …) are intact in the builder.
      // The wizard's goToConfirm may have rebuilt the config during navigation
      // before async player/comparison-player fetches resolved, potentially
      // discarding filter values that were present in the saved report.
      state.setCurrentReport(report);
    }
    setMode('builder');
  };

  const builderActions = mode === 'builder' && !state.isMobile ? (
    <>
      <Button onClick={onClose} variant="outlined" color="secondary">
        Abbrechen
      </Button>
      <Button
        onClick={state.handleSave}
        variant="contained"
        color="primary"
        disabled={!state.canSave}
      >
        Speichern
      </Button>
    </>
  ) : undefined;

  return (
    <BaseModal
      open={open}
      onClose={onClose}
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
        state.isMobile ? <MobileWizard state={state} /> : <DesktopLayout state={state} />
      )}

      <HelpDialog open={state.helpOpen} onClose={() => state.setHelpOpen(false)} />
    </BaseModal>
  );
};
