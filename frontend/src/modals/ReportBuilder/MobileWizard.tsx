import React from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Divider,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Fab,
  Drawer,
  Badge,
} from '@mui/material';
import PreviewIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { ReportBuilderState } from './types';
import { WIZARD_STEPS } from './types';
import { StepBasics } from './StepBasics';
import { StepDataChart } from './StepDataChart';
import { StepFilters } from './StepFilters';
import { StepOptions } from './StepOptions';
import { PreviewPanel } from './PreviewPanel';

interface MobileWizardProps {
  state: ReportBuilderState;
  /** Called when user clicks "Speichern" — parent opens the SaveDialog */
  onRequestSave?: () => void;
}

export const MobileWizard: React.FC<MobileWizardProps> = ({ state, onRequestSave = () => {} }) => {
  const {
    activeStep,
    setActiveStep,
    previewDrawerOpen,
    setPreviewDrawerOpen,
    hasPreview,
    previewData,
  } = state;

  const canOpenSave = !!(state.currentReport.config.xField && state.currentReport.config.yField);

  const stepComponents = [
    <StepBasics key="basics" state={state} />,
    <StepDataChart key="data" state={state} />,
    <StepFilters key="filters" state={state} />,
    <StepOptions key="options" state={state} />,
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Step indicator — compact horizontal */}
      <Stepper
        activeStep={activeStep}
        alternativeLabel
        sx={{
          mb: 2,
          '& .MuiStepLabel-label': {
            fontSize: '0.7rem',
            mt: 0.5,
          },
        }}
      >
        {WIZARD_STEPS.map((step, idx) => (
          <Step key={step.label} completed={idx < activeStep}>
            <StepLabel
              StepIconComponent={() => (
                <Box
                  onClick={() => setActiveStep(idx)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    bgcolor: idx === activeStep ? 'primary.main' : idx < activeStep ? 'success.main' : 'action.disabledBackground',
                    color: idx <= activeStep ? 'primary.contrastText' : 'text.disabled',
                    transition: 'all 0.2s',
                  }}
                >
                  {idx < activeStep ? <CheckCircleIcon fontSize="small" /> : step.icon}
                </Box>
              )}
            >
              {step.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step content */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          pb: 10,
          px: 0.5,
          pt: 1.5, // headroom for TextField floating labels, which extend ~10px above the input border
        }}
      >
        {stepComponents[activeStep]}
      </Box>

      {/* Navigation buttons — fixed bottom */}
      <Paper
        elevation={8}
        sx={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          zIndex: 10,
          gap: 1,
        }}
      >
        <Button
          onClick={() => setActiveStep(prev => prev - 1)}
          disabled={activeStep === 0}
          variant="text"
          size="large"
        >
          Zurück
        </Button>

        <Box display="flex" gap={1}>
          {activeStep < WIZARD_STEPS.length - 1 ? (
            <Button
              variant="contained"
              onClick={() => setActiveStep(prev => prev + 1)}
              size="large"
            >
              Weiter
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={onRequestSave}
              disabled={!canOpenSave}
              size="large"
            >
              Speichern
            </Button>
          )}
        </Box>
      </Paper>

      {/* Floating preview button */}
      {hasPreview && (
        <Fab
          color="secondary"
          onClick={() => setPreviewDrawerOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: (theme) => theme.zIndex.modal + 2,
          }}
          aria-label="Vorschau anzeigen"
        >
          <Badge color="info" variant="dot" invisible={!previewData}>
            <PreviewIcon />
          </Badge>
        </Fab>
      )}

      {/* Preview Drawer — slides up from bottom */}
      <Drawer
        anchor="bottom"
        open={previewDrawerOpen}
        onClose={() => setPreviewDrawerOpen(false)}
        PaperProps={{
          sx: {
            maxHeight: '85vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        }}
        ModalProps={{
          sx: { zIndex: (theme) => theme.zIndex.modal + 3 },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">Vorschau</Typography>
            <IconButton onClick={() => setPreviewDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <PreviewPanel state={state} />
        </Box>
      </Drawer>
    </Box>
  );
};
