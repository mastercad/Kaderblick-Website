import React, { useCallback, useEffect } from 'react';
import {
  Alert,
  Box,
  Step,
  StepLabel,
  Stepper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import BaseModal from './BaseModal';
import ImportMatchesDialog from './ImportMatchesDialog';
import ManualMatchesEditor from './ManualMatchesEditor';
import TournamentMatchGeneratorDialog from './TournamentMatchGeneratorDialog';
import { EventStepContent } from '../components/EventModal/EventStepContent';
import { EventModalActions } from '../components/EventModal/EventModalActions';
import { useTournamentMatches, useLeagues, useCups, useCupRounds, useReloadTournamentMatches } from '../hooks/useEventData';
import { useEventWizard } from '../hooks/useEventWizard';
import { useTournamentMatchHandlers } from '../hooks/useTournamentMatchHandlers';
import { apiRequest } from '../utils/api';
import { EventData, SelectOption, User } from '../types/event';

// ─── Props ────────────────────────────────────────────────────────────────────
interface EventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (formData: EventData) => void;
  onDelete?: () => void;
  showDelete?: boolean;
  event: EventData;
  eventTypes: SelectOption[];
  teams?: SelectOption[];
  /** All teams, bypassing user-assignment filter — used for match & tournament opponent selection. */
  allTeams?: SelectOption[];
  gameTypes?: SelectOption[];
  locations: SelectOption[];
  tournaments?: SelectOption[];
  users?: User[];
  loading?: boolean;
  onChange: (field: string, value: any) => void;
  teamDefaultsMap?: Record<string, { defaultHalfDuration?: number | null; defaultHalftimeBreakDuration?: number | null }>;
}

/**
 * EventModal — thin orchestrator.
 *
 * All wizard-navigation state lives in useEventWizard.
 * All tournament-match CRUD state lives in useTournamentMatchHandlers.
 * Step rendering is delegated to EventStepContent.
 * Footer buttons are delegated to EventModalActions.
 */
export const EventModal: React.FC<EventModalProps> = ({
  open,
  onClose,
  onSave,
  onDelete,
  showDelete = false,
  event,
  eventTypes,
  teams = [],
  allTeams = [],
  gameTypes = [],
  locations,
  tournaments = [],
  users = [],
  loading = false,
  onChange,
  teamDefaultsMap = {},
}) => {
  // For match/tournament events every team must be selectable as an opponent.
  // For training/permission fields only the user's own assigned teams are relevant.
  const matchTeams = allTeams.length > 0 ? allTeams : teams;

  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // ── External data hooks ───────────────────────────────────────────────────
  const { tournamentMatches, setTournamentMatches } = useTournamentMatches(event.tournamentId, open);
  const leagues       = useLeagues(open);
  const cups          = useCups(open);
  const cupRounds     = useCupRounds(open);
  const reloadMatches = useReloadTournamentMatches();

  // ── Fetch tournament settings when an existing tournament is selected ──────
  useEffect(() => {
    if (!open || !event.tournamentId) return;
    (async () => {
      try {
        const res = await apiRequest(`/api/tournaments/${event.tournamentId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.settings) {
          if (data.settings.type)           onChange('tournamentType',          data.settings.type);
          if (data.settings.roundDuration)  onChange('tournamentRoundDuration', data.settings.roundDuration);
          if (data.settings.breakTime)      onChange('tournamentBreakTime',     data.settings.breakTime);
          if (data.settings.gameMode)       onChange('tournamentGameMode',      data.settings.gameMode);
          if (data.settings.numberOfGroups) onChange('tournamentNumberOfGroups',data.settings.numberOfGroups);
        }
      } catch { /* ignore */ }
    })();
  }, [open, event.tournamentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Populate tournamentMatches from all available embedded sources ─────────
  useEffect(() => {
    if (!open) return;

    if (event?.pendingTournamentMatches?.length) {
      setTournamentMatches(
        event.pendingTournamentMatches.map((match: any, idx: number) => ({
          id: match.id || `draft-${idx}`,
          ...match,
          homeTeamName: teams.find(t => String(t.value) === String(match.homeTeamId))?.label || match.homeTeamName || '',
          awayTeamName: teams.find(t => String(t.value) === String(match.awayTeamId))?.label || match.awayTeamName || '',
        })),
      );
      return;
    }

    if (event?.tournament?.matches?.length) {
      setTournamentMatches(
        event.tournament.matches.map((match: any) => ({
          ...match,
          id: match.id || `embedded-${match.round}-${match.slot}`,
          homeTeamName: teams.find(t => String(t.value) === String(match.homeTeamId))?.label || match.homeTeamName || '',
          awayTeamName: teams.find(t => String(t.value) === String(match.awayTeamId))?.label || match.awayTeamName || '',
        })),
      );
    }
  }, [open, event?.pendingTournamentMatches?.length, event?.tournament?.matches?.length, teams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wizard navigation ─────────────────────────────────────────────────────
  const wizard = useEventWizard({
    open, event, eventTypes, gameTypes, onChange, onSave, onClose,
  });
  const { currentStep, steps, isLastStep, currentStepKey, stepError, setStepError, flags } = wizard;
  const { isMatchEvent, isTournament, isTournamentEventType, isTask, isTraining, isGenericEvent } = flags;

  // ── Stable onChange wrapper ───────────────────────────────────────────────
  const handleChange = useCallback(
    (field: string, value: any) => { if (typeof onChange === 'function') onChange(field, value); },
    [onChange],
  );

  // ── Tournament-match handlers ─────────────────────────────────────────────
  const matchHandlers = useTournamentMatchHandlers({
    event,
    tournamentMatches,
    setTournamentMatches,
    teams: matchTeams,
    onChange: handleChange,
    reloadMatches,
  });

  // ── Render ────────────────────────────────────────────────────────────────
  const modalTitle = event.title || 'Neues Event';

  return (
    <>
      <BaseModal
        open={open}
        onClose={onClose}
        title={modalTitle}
        maxWidth="md"
        fullScreen={isMobile}
        actions={
          <EventModalActions
            currentStep={currentStep}
            isLastStep={isLastStep}
            loading={loading}
            showDelete={showDelete}
            onDelete={onDelete}
            onClose={wizard.handleClose}
            onBack={wizard.handleBack}
            onNext={wizard.handleNext}
            onSave={wizard.handleSave}
          />
        }
      >
        {/* Stepper */}
        <Box sx={{ mb: { xs: 2, sm: 3 } }}>
          <Stepper
            activeStep={currentStep}
            alternativeLabel
            sx={{
              '& .MuiStepLabel-label': { fontSize: { xs: '0.7rem', sm: '0.875rem' } },
              '& .MuiStepIcon-root':   { fontSize: { xs: '1.2rem',  sm: '1.5rem'  } },
            }}
          >
            {steps.map((step, index) => (
              <Step key={step.key} completed={index < currentStep}>
                <StepLabel>{step.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Per-step validation error */}
        {stepError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setStepError(null)}>
            {stepError}
          </Alert>
        )}

        {/* Step content */}
        <Box sx={{ minHeight: { xs: 180, sm: 240 } }}>
          <EventStepContent
            currentStepKey={currentStepKey}
            event={event}
            eventTypes={eventTypes}
            locations={locations}
            teams={teams}
            matchTeams={matchTeams}
            gameTypes={gameTypes}
            tournaments={tournaments}
            leagues={leagues}
            cups={cups}
            cupRounds={cupRounds}
            users={users}
            tournamentMatches={tournamentMatches}
            isMobile={isMobile}
            isMatchEvent={isMatchEvent}
            isTournament={isTournament}
            isTournamentEventType={isTournamentEventType}
            isTask={isTask}
            isTraining={isTraining}
            isGenericEvent={isGenericEvent}
            editingMatchId={matchHandlers.editingMatchId}
            editingMatchDraft={matchHandlers.editingMatchDraft}
            setEditingMatchDraft={matchHandlers.setEditingMatchDraft}
            handleChange={handleChange}
            onTournamentMatchChange={matchHandlers.handleTournamentMatchChange}
            onImportOpen={() => matchHandlers.setImportOpen(true)}
            onManualOpen={() => matchHandlers.setManualOpen(true)}
            onGeneratorOpen={() => matchHandlers.setGeneratorOpen(true)}
            onGeneratePlan={matchHandlers.handleGeneratePlan}
            onClearMatches={() => {
              handleChange('pendingTournamentMatches', []);
              setTournamentMatches([]);
            }}
            onAddMatch={matchHandlers.handleAddMatch}
            onEditMatch={matchHandlers.handleEditMatch}
            onSaveMatch={matchHandlers.handleSaveMatch}
            onCancelEdit={matchHandlers.handleCancelEdit}
            onDeleteMatch={matchHandlers.handleDeleteMatch}
            teamDefaultsMap={teamDefaultsMap}
          />
        </Box>
      </BaseModal>

      {/* ── Sub-dialogs ───────────────────────────────────────────────────── */}
      {matchHandlers.importOpen && (
        <ImportMatchesDialog
          open={matchHandlers.importOpen}
          onClose={() => matchHandlers.setImportOpen(false)}
          tournamentId={event.tournamentId}
          initialMatches={tournamentMatches}
          onImported={matchHandlers.handleImportClose}
        />
      )}

      {matchHandlers.manualOpen && (
        <ManualMatchesEditor
          open={matchHandlers.manualOpen}
          onClose={() => matchHandlers.setManualOpen(false)}
          tournamentId={event.tournamentId}
          teams={matchTeams}
          matchTeams={event.teamIds}
          initialMatches={tournamentMatches}
          gameMode={event.tournamentGameMode || 'round_robin'}
          roundDuration={event.tournamentRoundDuration || 10}
          breakTime={event.tournamentBreakTime || 2}
          onSaved={matchHandlers.handleManualClose}
        />
      )}

      {matchHandlers.generatorOpen && (
        <TournamentMatchGeneratorDialog
          open={matchHandlers.generatorOpen}
          onClose={() => matchHandlers.setGeneratorOpen(false)}
          teams={matchTeams}
          matchTeams={event.teamIds}
          tournament={event.tournament}
          initialMatches={tournamentMatches}
          startDate={event.date}
          startTime={event.time}
          initialGameMode={event.tournamentGameMode || 'round_robin'}
          initialTournamentType={event.tournamentType || 'indoor_hall'}
          initialRoundDuration={event.tournamentRoundDuration || 10}
          initialBreakTime={event.tournamentBreakTime || 2}
          initialNumberOfGroups={event.tournamentNumberOfGroups || 2}
          onGenerate={matchHandlers.handleGeneratorClose}
        />
      )}
    </>
  );
};
