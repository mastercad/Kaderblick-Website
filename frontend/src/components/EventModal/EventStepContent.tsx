import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { EventBaseForm } from './EventBaseForm';
import { GameEventFields } from './GameEventFields';
import { GameTimingFields } from './GameTimingFields';
import { TaskEventFields } from './TaskEventFields';
import { TrainingEventFields } from './TrainingEventFields';
import { PermissionFields } from './PermissionFields';
import {
  TournamentConfig,
  TournamentMatchesManagement,
  TournamentSelection,
} from './TournamentFields';
import { WizardStep2Tournament } from './WizardSteps';
import { LocationField } from './LocationField';
import {
  STEP_BASE,
  STEP_DETAILS,
  STEP_TIMING,
  STEP_MATCHES,
  STEP_PERMISSIONS,
  STEP_DESCRIPTION,
  STEP_TRAINING_SCOPE,
  WizardStepKey,
} from './eventWizardConstants';
import { TrainingSeriesScopeStep } from './TrainingSeriesScopeStep';
import { EventData, SelectOption, User } from '../../types/event';

interface EventStepContentProps {
  currentStepKey: WizardStepKey;
  event: EventData;
  eventTypes: SelectOption[];
  locations: SelectOption[];
  /** Teams filtered to the current user — used for training / permissions. */
  teams: SelectOption[];
  /** All teams — used for match / tournament opponent selection. */
  matchTeams: SelectOption[];
  gameTypes: SelectOption[];
  tournaments: SelectOption[];
  leagues: SelectOption[];
  cups: SelectOption[];
  users: User[];
  tournamentMatches: any[];
  isMobile: boolean;
  isMatchEvent: boolean;
  isTournament: boolean;
  isTournamentEventType: boolean;
  isTask: boolean;
  isTraining: boolean;
  isGenericEvent: boolean;
  editingMatchId: string | number | null;
  editingMatchDraft: any;
  setEditingMatchDraft: (draft: any) => void;
  handleChange: (field: string, value: any) => void;
  onTournamentMatchChange: (matchId: string) => void;
  onImportOpen: () => void;
  onManualOpen: () => void;
  onGeneratorOpen: () => void;
  onGeneratePlan: () => void;
  onClearMatches: () => void;
  onAddMatch: () => void;
  onEditMatch: (match: any) => void;
  onSaveMatch: () => void;
  onCancelEdit: () => void;
  onDeleteMatch: (matchId: string | number) => void;
  /** Per-team timing defaults, keyed by team id string. Used in STEP_TIMING. */
  teamDefaultsMap?: Record<string, { defaultHalfDuration?: number | null; defaultHalftimeBreakDuration?: number | null }>;
}

/**
 * Renders the content for each wizard step.
 * Purely presentational — all handlers are provided via props.
 */
export const EventStepContent: React.FC<EventStepContentProps> = ({
  currentStepKey,
  event,
  eventTypes,
  locations,
  teams,
  matchTeams,
  gameTypes,
  tournaments,
  leagues,
  cups,
  users,
  tournamentMatches,
  isMobile,
  isMatchEvent,
  isTournament,
  isTournamentEventType,
  isTask,
  isTraining,
  isGenericEvent,
  editingMatchId,
  editingMatchDraft,
  setEditingMatchDraft,
  handleChange,
  onTournamentMatchChange,
  onImportOpen,
  onManualOpen,
  onGeneratorOpen,
  onGeneratePlan,
  onClearMatches,
  onAddMatch,
  onEditMatch,
  onSaveMatch,
  onCancelEdit,
  onDeleteMatch,
  teamDefaultsMap = {},
}) => {
  const selectedGameTypeLabel = gameTypes.find(gt => gt.value === event.gameType)?.label?.toLowerCase() ?? '';
  const isLiga  = selectedGameTypeLabel.includes('liga');
  const isPokal = selectedGameTypeLabel.includes('pokal');

  switch (currentStepKey) {

    case STEP_BASE:
      return (
        <EventBaseForm
          formData={event}
          eventTypes={eventTypes}
          locations={locations}
          handleChange={handleChange}
        />
      );

    case STEP_DETAILS:
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {/* Location — shown for match and training events */}
          {(isMatchEvent || isTraining) && (
            <LocationField
              locations={locations}
              value={event.locationId}
              onChange={v => handleChange('locationId', v)}
            />
          )}

          {/* Match / Tournament fields */}
          {isMatchEvent && (
            <>
              <GameEventFields
                formData={event}
                teams={matchTeams}
                gameTypes={gameTypes}
                leagues={leagues}
                cups={cups}
                isTournament={isTournament}
                isTournamentEventType={isTournamentEventType}
                isLiga={isLiga}
                isPokal={isPokal}
                handleChange={handleChange}
              />
              {(isTournament || event.tournamentId) && (
                <Box sx={{ mt: 1 }}>
                  <TournamentSelection
                    formData={event}
                    tournaments={tournaments}
                    tournamentMatches={tournamentMatches}
                    onChange={handleChange}
                    onTournamentMatchChange={onTournamentMatchChange}
                  />
                  <TournamentConfig
                    formData={event}
                    isExistingTournament={!!event.tournamentId}
                    onChange={handleChange}
                  />
                  <TournamentMatchesManagement
                    tournamentMatches={tournamentMatches}
                    onImportOpen={onImportOpen}
                    onManualOpen={onManualOpen}
                    onGeneratorOpen={onGeneratorOpen}
                    onGeneratePlan={onGeneratePlan}
                    onClearMatches={onClearMatches}
                    showOldGeneration={!!event.tournamentId}
                  />
                </Box>
              )}
            </>
          )}

          {/* Task fields */}
          {isTask && (
            <TaskEventFields formData={event} users={users} handleChange={handleChange} />
          )}

          {/* Training fields */}
          {isTraining && (
            <TrainingEventFields formData={event} teams={teams} handleChange={handleChange} />
          )}

          {/* No type selected yet — hint */}
          {!isMatchEvent && !isTask && !isTraining && !isGenericEvent && (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary" variant="body2">
                Bitte zuerst den Event-Typ auf Schritt 1 auswählen.
              </Typography>
            </Box>
          )}
        </Box>
      );

    case STEP_TIMING: {
      const homeTeamDefaults = event.homeTeam ? (teamDefaultsMap[event.homeTeam] ?? {}) : {};
      return (
        <GameTimingFields
          formData={event}
          onChange={handleChange}
          teamDefaultHalfDuration={homeTeamDefaults.defaultHalfDuration}
          teamDefaultHalftimeBreakDuration={homeTeamDefaults.defaultHalftimeBreakDuration}
        />
      );
    }

    case STEP_MATCHES:
      return (
        <WizardStep2Tournament
          tournamentMatches={tournamentMatches}
          teams={matchTeams}
          editingMatchId={editingMatchId}
          editingMatchDraft={editingMatchDraft}
          onAddMatch={onAddMatch}
          onEditMatch={onEditMatch}
          onSaveMatch={onSaveMatch}
          onCancelEdit={onCancelEdit}
          onDeleteMatch={onDeleteMatch}
          setEditingMatchDraft={setEditingMatchDraft}
        />
      );

    case STEP_PERMISSIONS:
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <LocationField
            locations={locations}
            value={event.locationId}
            onChange={v => handleChange('locationId', v)}
          />
          <PermissionFields
            formData={event}
            teams={teams}
            users={users}
            handleChange={handleChange}
          />
        </Box>
      );

    case STEP_TRAINING_SCOPE: {
      // True when only the series end date changed and everything else stayed the same.
      // In that case the "Bis wann gilt die Änderung?" section is redundant / circular.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const onlyEndDateChanged = useMemo(() => {
        if (!event.trainingSeriesId || !event.trainingOriginalEndDate) return false;
        if (event.trainingOriginalEndDate === event.trainingEndDate) return false;
        const currentContentKey = [event.title, event.locationId ?? '', event.time, event.trainingTeamId ?? ''].join('|');
        if (event.trainingOriginalContentKey && event.trainingOriginalContentKey !== currentContentKey) return false;
        if (event.trainingOriginalDate && event.trainingOriginalDate !== event.date) return false;
        const origWd = [...(event.trainingOriginalWeekdays ?? [])].sort().join(',');
        const currWd = [...(event.trainingWeekdays ?? [])].sort().join(',');
        if (origWd !== currWd) return false;
        return true;
      }, [event]);
      return (
        <TrainingSeriesScopeStep event={event} handleChange={handleChange} onlyEndDateChanged={onlyEndDateChanged} />
      );
    }

    case STEP_DESCRIPTION:
      return (
        <TextField
          label="Beschreibung"
          value={event.description || ''}
          onChange={e => handleChange('description', e.target.value)}
          fullWidth
          margin="normal"
          multiline
          rows={isMobile ? 6 : 8}
          placeholder="Optionale Beschreibung für dieses Event …"
        />
      );

    default:
      return null;
  }
};
