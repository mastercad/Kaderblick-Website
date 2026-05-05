import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  LinearProgress,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TuneIcon from '@mui/icons-material/Tune';
import type { Report, ReportConfig, ReportBuilderState } from './types';
import { PreviewPanel } from './PreviewPanel';
import { OptionCard } from './OptionCard';
import { StepContext } from './StepContext';
import { useWizardState } from './useWizardState';
import { SUBJECT_OPTIONS, TIME_OPTIONS } from './wizardTypes';
import { getSuggestedTypes, WIZARD_DIAGRAM_TYPE_LABELS } from './wizardLogic';

export interface GuidedWizardProps {
  state: ReportBuilderState;
  onSave: (report: Report) => Promise<void>;
  onClose: () => void;
  /** Switch to full-featured builder (with the current config pre-applied) */
  onOpenBuilder: () => void;
  onBack: () => void;
  /** If provided, reverse-maps the config and pre-fills the wizard for re-editing */
  initialConfig?: ReportConfig;
}

export const GuidedWizard: React.FC<GuidedWizardProps> = (props) => {
  const wiz = useWizardState(props);

  if (wiz.isInitializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  const { step, subject, topic, timeRange, topicOptions } = wiz;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 } }}>

      {/* ── Progress bar (hidden on confirm step) ── */}
      {step < 4 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Schritt {wiz.visibleStep + 1} von {wiz.totalSteps} — {wiz.stepLabels[step] ?? ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {Math.round(wiz.progress)}%
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={wiz.progress} sx={{ borderRadius: 1, height: 5 }} />
        </Box>
      )}

      {/* ── Step 0: Subject ── */}
      {step === 0 && (
        <Box>
          <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.5 }}>
            Über wen soll der Bericht sein?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Einfach antippen — es geht danach automatisch weiter.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {SUBJECT_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                option={opt}
                selected={subject === opt.value}
                onSelect={wiz.handleSelectSubject}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* ── Step 1: Context selection ── */}
      {step === 1 && subject && (
        <StepContext
          subject={subject}
          selectedPlayer={wiz.selectedPlayer}
          setSelectedPlayer={wiz.setSelectedPlayer}
          selectedTeam={wiz.selectedTeam}
          setSelectedTeam={wiz.setSelectedTeam}
          selectedComparisonTeams={wiz.selectedComparisonTeams}
          setSelectedComparisonTeams={wiz.setSelectedComparisonTeams}
          selectedComparisonPlayers={wiz.selectedComparisonPlayers}
          setSelectedComparisonPlayers={wiz.setSelectedComparisonPlayers}
          playerSearchInput={wiz.playerSearchInput}
          setPlayerSearchInput={wiz.setPlayerSearchInput}
          playerSearchOptions={wiz.playerSearchOptions}
          playerSearchLoading={wiz.playerSearchLoading}
          teams={wiz.teams}
          linkedTeams={wiz.linkedTeams}
        />
      )}

      {/* ── Step 2: Topic ── */}
      {step === 2 && subject && (
        <Box>
          <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.5 }}>
            Was möchtest du wissen?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Einfach antippen — es geht danach automatisch weiter.
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: { xs: 1, sm: 1.5 },
            }}
          >
            {topicOptions.map(opt => (
              <OptionCard
                key={opt.value}
                option={opt}
                selected={topic === opt.value}
                onSelect={wiz.handleSelectTopic}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* ── Step 3: Time range ── */}
      {step === 3 && (
        <Box>
          <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.5 }}>
            Wie weit zurückschauen?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Einfach antippen — es geht danach automatisch weiter.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {TIME_OPTIONS.map(opt => (
              <OptionCard
                key={opt.value}
                option={opt}
                selected={timeRange === opt.value}
                onSelect={wiz.handleSelectTimeRange}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* ── Step 4: Confirm ── */}
      {step === 4 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.5 }}>
              ✅ Fast fertig!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gib deiner Auswertung noch einen Namen und tippe auf „Speichern".
            </Typography>
          </Box>
          <TextField
            fullWidth
            label="Name der Auswertung"
            value={wiz.reportName}
            onChange={e => wiz.setReportName(e.target.value)}
            size="small"
            inputRef={wiz.nameRef}
            onKeyDown={e => { if (e.key === 'Enter' && wiz.reportName.trim()) wiz.handleSave(); }}
          />

          {/* ── Chart-Typ Auswahl: nur sinnvolle Alternativen ── */}
          {subject && topic && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                Darstellungsart
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {getSuggestedTypes(subject, topic).map(type => {
                  const isActive = (props.state.currentReport.config.diagramType ?? 'bar') === type;
                  return (
                    <Tooltip key={type} title={WIZARD_DIAGRAM_TYPE_LABELS[type] ?? type}>
                      <Chip
                        label={WIZARD_DIAGRAM_TYPE_LABELS[type] ?? type}
                        size="small"
                        onClick={() => {
                          const isComparison = subject === 'player_comparison' || subject === 'team_comparison';
                          const isTeamDist = subject === 'team';
                          const needsMultiColor = type === 'bar' && (isComparison || isTeamDist);
                          props.state.setCurrentReport(prev => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              diagramType: type,
                              multiColor: needsMultiColor ? true : undefined,
                              showLegend: ['doughnut', 'pie'].includes(type),
                            },
                          }));
                        }}
                        color={isActive ? 'primary' : 'default'}
                        variant={isActive ? 'filled' : 'outlined'}
                        sx={{ cursor: 'pointer' }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={
                  <Checkbox
                    size="small"
                    checked={!!(props.state.currentReport.config as any).hideEmpty}
                    onChange={(e) =>
                      props.state.setCurrentReport(prev => ({
                        ...prev,
                        config: { ...prev.config, hideEmpty: e.target.checked || undefined },
                      }))
                    }
                  />
                }
                label={
                  <Typography variant="caption" color="text.secondary">
                    Einträge ohne Wert ausblenden
                  </Typography>
                }
              />
            </Box>
          )}

          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              p: 1,
              minHeight: wiz.isMobile ? 200 : 280,
              bgcolor: 'background.default',
            }}
          >
            <PreviewPanel state={props.state} />
          </Box>
        </Box>
      )}

      {/* ── Sticky bottom nav ── */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          pt: 1.5,
          pb: { xs: 1, sm: 1.5 },
          px: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
          mt: 'auto',
        }}
      >
        <Button
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={wiz.handleBack}
          color="inherit"
        >
          Zurück
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {step === 4 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<TuneIcon fontSize="small" />}
              onClick={() => props.onOpenBuilder()}
            >
              Anpassen
            </Button>
          )}
          {step < 4 ? (
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                if (step === 0 && subject) wiz.setStep(wiz.hasContextStep(subject) ? 1 : 2);
                else if (step === 1) wiz.setStep(2);
                else if (step === 2 && topic) wiz.setStep(3);
                else if (step === 3 && subject && topic && timeRange) wiz.goToConfirm(subject, topic, timeRange);
              }}
              disabled={
                (step === 0 && !subject) ||
                (step === 1 && !wiz.contextStepCanContinue) ||
                (step === 2 && !topic) ||
                (step === 3 && !timeRange)
              }
            >
              Weiter →
            </Button>
          ) : (
            <Button
              variant="contained"
              size="small"
              onClick={wiz.handleSave}
              disabled={!wiz.reportName.trim() || wiz.saving}
              startIcon={wiz.saving ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              Speichern
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};
