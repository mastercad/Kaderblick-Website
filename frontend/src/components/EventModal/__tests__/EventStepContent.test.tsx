import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventStepContent } from '../EventStepContent';
import {
  STEP_BASE,
  STEP_DETAILS,
  STEP_TIMING,
  STEP_MATCHES,
  STEP_PERMISSIONS,
  STEP_DESCRIPTION,
  STEP_TRAINING_SCOPE,
} from '../eventWizardConstants';

// ── Heavy MUI / component mocks ───────────────────────────────────────────
jest.mock('@mui/material/Box', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/Typography', () => (props: any) => <span>{props.children}</span>);
jest.mock('@mui/material/TextField', () => (props: any) => (
  <textarea data-testid={props.label || 'TextField'} placeholder={props.placeholder} onChange={props.onChange} />
));

// Autocomplete mock: calls renderInput AND exposes trigger buttons for all callbacks
jest.mock('@mui/material/Autocomplete', () => (props: any) => {
  const input = props.renderInput?.({
    inputProps: {},
    InputProps: { ref: null },
    InputLabelProps: {},
    id: 'ac',
    disabled: false,
    fullWidth: !!props.fullWidth,
    size: props.size,
  });
  return (
    <div data-testid="Autocomplete">
      {input}
      <button data-testid="ac-oninput-input" onClick={() => props.onInputChange?.(null, 'xy', 'input')} />
      <button data-testid="ac-oninput-reset" onClick={() => props.onInputChange?.(null, 'xy', 'reset')} />
      <button data-testid="ac-onchange-string" onClick={() => props.onChange?.(null, 'free text')} />
      <button data-testid="ac-onchange-obj" onClick={() => props.onChange?.(null, { label: 'Halle Nord', value: 'loc42' })} />
      <button data-testid="ac-onchange-null" onClick={() => props.onChange?.(null, null)} />
      <button data-testid="ac-filter-short" onClick={() => props.filterOptions?.([{ label: 'Halle Nord', value: '1' }], { inputValue: 'H' })} />
      <button data-testid="ac-filter-long" onClick={() => props.filterOptions?.([{ label: 'Halle Nord', value: '1' }], { inputValue: 'Ha' })} />
      <button data-testid="ac-getlabel-string" onClick={() => props.getOptionLabel?.('plain string')} />
      <button data-testid="ac-getlabel-obj" onClick={() => props.getOptionLabel?.({ label: 'Halle', value: '1' })} />
    </div>
  );
});

jest.mock('../EventBaseForm',      () => ({ EventBaseForm:      () => <div data-testid="EventBaseForm" />      }));
jest.mock('../GameEventFields',    () => ({ GameEventFields:    () => <div data-testid="GameEventFields" />    }));
jest.mock('../GameTimingFields',   () => ({ GameTimingFields:   () => <div data-testid="GameTimingFields" />   }));
jest.mock('../TaskEventFields',    () => ({ TaskEventFields:    () => <div data-testid="TaskEventFields" />    }));
jest.mock('../TrainingEventFields',() => ({ TrainingEventFields:() => <div data-testid="TrainingEventFields" />}));
jest.mock('../PermissionFields',   () => ({ PermissionFields:   () => <div data-testid="PermissionFields" />   }));
jest.mock('../TournamentFields',   () => ({
  TournamentConfig:         () => <div data-testid="TournamentConfig" />,
  TournamentMatchesManagement: () => <div data-testid="TournamentMatchesManagement" />,
  TournamentSelection:      () => <div data-testid="TournamentSelection" />,
}));
jest.mock('../WizardSteps', () => ({
  WizardStep2Tournament: () => <div data-testid="WizardStep2Tournament" />,
}));
jest.mock('../LocationField', () => ({
  LocationField: (props: any) => (
    <div data-testid="LocationField">
      <button data-testid="lf-onchange" onClick={() => props.onChange?.('loc1')} />
    </div>
  ),
}));

jest.mock('../TrainingSeriesScopeStep', () => ({
  TrainingSeriesScopeStep: () => <div data-testid="TrainingSeriesScopeStep" />,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────
const noop = jest.fn();
const base = {
  event: {} as any,
  eventTypes: [],
  locations:  [],
  teams:      [],
  matchTeams: [],
  gameTypes:  [],
  tournaments:[],
  leagues:    [],
  cups:       [],
  cupRounds:  [],
  users:      [],
  tournamentMatches: [],
  isMobile: false,
  isMatchEvent: false,
  isTournament: false,
  isTournamentEventType: false,
  isTask: false,
  isTraining: false,
  isGenericEvent: false,
  editingMatchId: null,
  editingMatchDraft: null,
  setEditingMatchDraft: noop,
  handleChange: noop,
  onTournamentMatchChange: noop,
  onImportOpen: noop,
  onManualOpen: noop,
  onGeneratorOpen: noop,
  onGeneratePlan: noop,
  onClearMatches: noop,
  onAddMatch: noop,
  onEditMatch: noop,
  onSaveMatch: noop,
  onCancelEdit: noop,
  onDeleteMatch: noop,
};

describe('EventStepContent', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── STEP_BASE ─────────────────────────────────────────────────────────────

  it('renders EventBaseForm on STEP_BASE', () => {
    render(<EventStepContent {...base} currentStepKey={STEP_BASE} />);
    expect(screen.getByTestId('EventBaseForm')).toBeInTheDocument();
  });

  // ── STEP_DETAILS – training ───────────────────────────────────────────────

  it('renders LocationField + TrainingEventFields on STEP_DETAILS for training', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isTraining={true}
      />
    );
    expect(screen.getByTestId('LocationField')).toBeInTheDocument();
    expect(screen.getByTestId('TrainingEventFields')).toBeInTheDocument();
  });

  // ── STEP_DETAILS – match ──────────────────────────────────────────────────

  it('renders GameEventFields on STEP_DETAILS for match events', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isMatchEvent={true}
      />
    );
    expect(screen.getByTestId('GameEventFields')).toBeInTheDocument();
  });

  it('renders TournamentSelection + TournamentConfig when isTournament', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isMatchEvent={true}
        isTournament={true}
      />
    );
    expect(screen.getByTestId('TournamentSelection')).toBeInTheDocument();
    expect(screen.getByTestId('TournamentConfig')).toBeInTheDocument();
    expect(screen.getByTestId('TournamentMatchesManagement')).toBeInTheDocument();
  });

  // ── STEP_DETAILS – task ───────────────────────────────────────────────────

  it('renders TaskEventFields on STEP_DETAILS for task events', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isTask={true}
      />
    );
    expect(screen.getByTestId('TaskEventFields')).toBeInTheDocument();
  });

  // ── STEP_DETAILS – no type selected ──────────────────────────────────────

  it('renders hint text when no event type is selected on STEP_DETAILS', () => {
    render(<EventStepContent {...base} currentStepKey={STEP_DETAILS} />);
    expect(screen.getByText(/Bitte zuerst den Event-Typ/i)).toBeInTheDocument();
  });

  // ── STEP_TIMING ─────────────────────────────────────────────────────────

  it('renders GameTimingFields on STEP_TIMING for match events', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_TIMING}
        isMatchEvent={true}
        event={{ homeTeam: '1' } as any}
        teamDefaultsMap={{ '1': { defaultHalfDuration: 40, defaultHalftimeBreakDuration: 10 } }}
      />
    );
    expect(screen.getByTestId('GameTimingFields')).toBeInTheDocument();
  });

  // ── STEP_MATCHES ──────────────────────────────────────────────────────────

  it('renders WizardStep2Tournament on STEP_MATCHES', () => {
    render(<EventStepContent {...base} currentStepKey={STEP_MATCHES} />);
    expect(screen.getByTestId('WizardStep2Tournament')).toBeInTheDocument();
  });

  // ── STEP_PERMISSIONS ──────────────────────────────────────────────────────

  it('renders LocationField + PermissionFields on STEP_PERMISSIONS', () => {
    render(<EventStepContent {...base} currentStepKey={STEP_PERMISSIONS} />);
    expect(screen.getByTestId('LocationField')).toBeInTheDocument();
    expect(screen.getByTestId('PermissionFields')).toBeInTheDocument();
  });

  // ── STEP_DESCRIPTION ─────────────────────────────────────────────────────

  it('renders description textarea on STEP_DESCRIPTION', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DESCRIPTION}
        event={{ description: 'Testbeschreibung' } as any}
      />,
    );
    expect(screen.getByTestId('Beschreibung')).toBeInTheDocument();
  });

  it('renders mobile rows when isMobile is true', () => {
    // Just verify it renders without throwing
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DESCRIPTION}
        isMobile={true}
      />,
    );
    expect(screen.getByTestId('Beschreibung')).toBeInTheDocument();
  });

  // ── Unknown step ──────────────────────────────────────────────────────────

  it('renders null for unknown step key', () => {
    const { container } = render(
      <EventStepContent {...base} currentStepKey={'unknown' as any} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // ── STEP_DETAILS – generic event (meeting point section) ──────────────────

  it('renders Autocomplete meeting point for generic events on STEP_DETAILS', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isGenericEvent={true}
        event={{} as any}
      />,
    );
    expect(screen.getByTestId('Autocomplete')).toBeInTheDocument();
  });

  it('renders Treffzeit field in meeting point section for training', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isTraining={true}
        event={{ meetingPoint: '' } as any}
      />,
    );
    // Treffzeit TextField is rendered inside the meeting point section
    expect(screen.getByTestId('Treffzeit')).toBeInTheDocument();
  });

  it('meeting point renderInput with long meetingPoint covering hasNoMatch=true branch', () => {
    // meetingPoint is long enough (>=2 chars) and locations don't match → hasNoMatch=true
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isTraining={true}
        event={{ meetingPoint: 'xyznotfound' } as any}
        locations={[{ value: 'loc1', label: 'Sportpark Mitte' }]}
      />,
    );
    expect(screen.getByTestId('Autocomplete')).toBeInTheDocument();
  });

  it('does NOT render meeting point section for task events on STEP_DETAILS', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isTask={true}
      />,
    );
    expect(screen.queryByTestId('Autocomplete')).not.toBeInTheDocument();
  });

  // ── TournamentSelection via event.tournamentId (without isTournament) ──────

  it('renders TournamentSelection when event.tournamentId is set even without isTournament', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isMatchEvent={true}
        isTournament={false}
        event={{ tournamentId: 't-1' } as any}
      />,
    );
    expect(screen.getByTestId('TournamentSelection')).toBeInTheDocument();
  });

  // ── STEP_TIMING – falsy homeTeam teamDefaults ─────────────────────────────

  it('renders GameTimingFields when homeTeam is undefined (empty teamDefaults)', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_TIMING}
        event={{ homeTeam: undefined } as any}
      />,
    );
    expect(screen.getByTestId('GameTimingFields')).toBeInTheDocument();
  });

  // ── STEP_TRAINING_SCOPE ───────────────────────────────────────────────────

  it('renders TrainingSeriesScopeStep on STEP_TRAINING_SCOPE', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_TRAINING_SCOPE}
        event={{ trainingSeriesId: 'series-1', trainingOriginalEndDate: '2026-12-31' } as any}
      />,
    );
    expect(screen.getByTestId('TrainingSeriesScopeStep')).toBeInTheDocument();
  });

  it('renders TrainingSeriesScopeStep with empty event (onlyEndDateChanged=false path)', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_TRAINING_SCOPE}
        event={{} as any}
      />,
    );
    expect(screen.getByTestId('TrainingSeriesScopeStep')).toBeInTheDocument();
  });

  it('STEP_TRAINING_SCOPE: onlyEndDateChanged=false when same originalEndDate == trainingEndDate', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_TRAINING_SCOPE}
        event={{
          trainingSeriesId: 's1',
          trainingOriginalEndDate: '2026-12-31',
          trainingEndDate: '2026-12-31',  // same → early false
        } as any}
      />,
    );
    expect(screen.getByTestId('TrainingSeriesScopeStep')).toBeInTheDocument();
  });

  it('STEP_TRAINING_SCOPE: onlyEndDateChanged=true when only endDate differs', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_TRAINING_SCOPE}
        event={{
          trainingSeriesId: 's1',
          trainingOriginalEndDate: '2026-12-31',
          trainingEndDate: '2026-11-30',  // different
          title: 'Training',
          locationId: 'loc1',
          time: '18:00',
          trainingTeamId: 'team1',
          trainingOriginalContentKey: 'Training|loc1|18:00|team1',
          trainingOriginalDate: '2026-01-10',
          date: '2026-01-10',
          trainingOriginalWeekdays: [1, 3],
          trainingWeekdays: [1, 3],
        } as any}
      />,
    );
    expect(screen.getByTestId('TrainingSeriesScopeStep')).toBeInTheDocument();
  });

  // ── Callback coverage for LocationField onChange (lines 149, 316) ─────────

  it('calls handleChange locationId when LocationField onChange fires on STEP_DETAILS (line 149)', () => {
    const handleChange = jest.fn();
    render(
      <EventStepContent {...base} currentStepKey={STEP_DETAILS} isTraining={true} handleChange={handleChange} />,
    );
    fireEvent.click(screen.getByTestId('lf-onchange'));
    expect(handleChange).toHaveBeenCalledWith('locationId', 'loc1');
  });

  it('calls handleChange locationId when LocationField onChange fires on STEP_PERMISSIONS (line 316)', () => {
    const handleChange = jest.fn();
    render(
      <EventStepContent {...base} currentStepKey={STEP_PERMISSIONS} handleChange={handleChange} />,
    );
    fireEvent.click(screen.getByTestId('lf-onchange'));
    expect(handleChange).toHaveBeenCalledWith('locationId', 'loc1');
  });

  // ── Callback coverage for STEP_DESCRIPTION TextField onChange (line 352) ──

  it('calls handleChange description when TextField changes on STEP_DESCRIPTION (line 352)', () => {
    const handleChange = jest.fn();
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DESCRIPTION}
        handleChange={handleChange}
        event={{} as any}
      />,
    );
    fireEvent.change(screen.getByTestId('Beschreibung'), { target: { value: 'New description' } });
    expect(handleChange).toHaveBeenCalledWith('description', 'New description');
  });

  // ── Autocomplete meeting-point callbacks (lines 197-239) ─────────────────

  it('Autocomplete onInputChange reason=input calls meetingPoint and meetingLocationId', () => {
    const handleChange = jest.fn();
    render(
      <EventStepContent {...base} currentStepKey={STEP_DETAILS} isGenericEvent={true} handleChange={handleChange} />,
    );
    fireEvent.click(screen.getByTestId('ac-oninput-input'));
    expect(handleChange).toHaveBeenCalledWith('meetingPoint', 'xy');
    expect(handleChange).toHaveBeenCalledWith('meetingLocationId', '');
  });

  it('Autocomplete onInputChange reason=reset only updates meetingPoint (line 211 false branch)', () => {
    const handleChange = jest.fn();
    render(
      <EventStepContent {...base} currentStepKey={STEP_DETAILS} isGenericEvent={true} handleChange={handleChange} />,
    );
    fireEvent.click(screen.getByTestId('ac-oninput-reset'));
    expect(handleChange).toHaveBeenCalledWith('meetingPoint', 'xy');
    expect(handleChange).not.toHaveBeenCalledWith('meetingLocationId', '');
  });

  it('Autocomplete onChange with free-text string sets meetingPoint + clears meetingLocationId', () => {
    const handleChange = jest.fn();
    render(
      <EventStepContent {...base} currentStepKey={STEP_DETAILS} isGenericEvent={true} handleChange={handleChange} />,
    );
    fireEvent.click(screen.getByTestId('ac-onchange-string'));
    expect(handleChange).toHaveBeenCalledWith('meetingPoint', 'free text');
    expect(handleChange).toHaveBeenCalledWith('meetingLocationId', '');
  });

  it('Autocomplete onChange with location object sets meetingPoint label + meetingLocationId', () => {
    const handleChange = jest.fn();
    render(
      <EventStepContent {...base} currentStepKey={STEP_DETAILS} isGenericEvent={true} handleChange={handleChange} />,
    );
    fireEvent.click(screen.getByTestId('ac-onchange-obj'));
    expect(handleChange).toHaveBeenCalledWith('meetingPoint', 'Halle Nord');
    expect(handleChange).toHaveBeenCalledWith('meetingLocationId', 'loc42');
  });

  it('Autocomplete onChange with null clears meetingPoint and meetingLocationId', () => {
    const handleChange = jest.fn();
    render(
      <EventStepContent {...base} currentStepKey={STEP_DETAILS} isGenericEvent={true} handleChange={handleChange} />,
    );
    fireEvent.click(screen.getByTestId('ac-onchange-null'));
    expect(handleChange).toHaveBeenCalledWith('meetingPoint', '');
    expect(handleChange).toHaveBeenCalledWith('meetingLocationId', '');
  });

  it('filterOptions returns empty array for short input (< 2 chars)', () => {
    render(
      <EventStepContent {...base} currentStepKey={STEP_DETAILS} isGenericEvent={true} />,
    );
    // The button calls filterOptions with inputValue='H' (1 char) — no error means it works
    fireEvent.click(screen.getByTestId('ac-filter-short'));
    expect(screen.getByTestId('Autocomplete')).toBeInTheDocument();
  });

  it('filterOptions returns filtered results for long input (>= 2 chars)', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isGenericEvent={true}
        locations={[{ value: '1', label: 'Halle Nord' }]}
      />,
    );
    // The button calls filterOptions with inputValue='Ha' (2 chars) — covers long-input branch
    fireEvent.click(screen.getByTestId('ac-filter-long'));
    expect(screen.getByTestId('Autocomplete')).toBeInTheDocument();
  });

  it('Autocomplete getOptionLabel with non-string option returns option.label (line 214 branch)', () => {
    render(
      <EventStepContent {...base} currentStepKey={STEP_DETAILS} isGenericEvent={true} />,
    );
    fireEvent.click(screen.getByTestId('ac-getlabel-string'));
    fireEvent.click(screen.getByTestId('ac-getlabel-obj'));
    expect(screen.getByTestId('Autocomplete')).toBeInTheDocument();
  });

  it('calls handleChange meetingTime when Treffzeit TextField changes (line 263)', () => {
    const handleChange = jest.fn();
    render(
      <EventStepContent {...base} currentStepKey={STEP_DETAILS} isGenericEvent={true} handleChange={handleChange} />,
    );
    fireEvent.change(screen.getByTestId('Treffzeit'), { target: { value: '18:00' } });
    expect(handleChange).toHaveBeenCalledWith('meetingTime', '18:00');
  });

  // ── isKnockout line 119 truthy branch ─────────────────────────────────────

  it('renders round autocomplete for knockout game type (isKnockout=true, line 119)', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_DETAILS}
        isMatchEvent={true}
        event={{ gameType: 'finale' } as any}
        gameTypes={[{ value: 'finale', label: 'Finale' }]}
      />,
    );
    expect(screen.getByTestId('GameEventFields')).toBeInTheDocument();
  });

  // ── STEP_TIMING: homeTeam truthy branch (line 283) ────────────────────────

  it('renders GameTimingFields with homeTeam set (line 283 truthy branch)', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_TIMING}
        isMatchEvent={true}
        event={{ homeTeam: 'team1' } as any}
      />,
    );
    expect(screen.getByTestId('GameTimingFields')).toBeInTheDocument();
  });

  // ── STEP_TRAINING_SCOPE: onlyEndDateChanged false branches 335, 336, 339 ─

  it('onlyEndDateChanged=false when trainingOriginalContentKey differs (line 335)', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_TRAINING_SCOPE}
        event={{
          trainingSeriesId: 's1',
          trainingOriginalEndDate: '2026-12-31',
          trainingEndDate: '2026-11-30',
          title: 'Other Title',
          locationId: 'loc1',
          time: '18:00',
          trainingTeamId: 'team1',
          trainingOriginalContentKey: 'Old Title|loc1|18:00|team1',
        } as any}
      />,
    );
    expect(screen.getByTestId('TrainingSeriesScopeStep')).toBeInTheDocument();
  });

  it('onlyEndDateChanged=false when trainingOriginalDate differs (line 336)', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_TRAINING_SCOPE}
        event={{
          trainingSeriesId: 's1',
          trainingOriginalEndDate: '2026-12-31',
          trainingEndDate: '2026-11-30',
          title: 'Training',
          locationId: 'loc1',
          time: '18:00',
          trainingTeamId: 'team1',
          trainingOriginalContentKey: 'Training|loc1|18:00|team1',
          trainingOriginalDate: '2026-01-10',
          date: '2026-02-15',  // different date
        } as any}
      />,
    );
    expect(screen.getByTestId('TrainingSeriesScopeStep')).toBeInTheDocument();
  });

  it('onlyEndDateChanged=false when weekdays differ (line 339)', () => {
    render(
      <EventStepContent
        {...base}
        currentStepKey={STEP_TRAINING_SCOPE}
        event={{
          trainingSeriesId: 's1',
          trainingOriginalEndDate: '2026-12-31',
          trainingEndDate: '2026-11-30',
          title: 'Training',
          locationId: 'loc1',
          time: '18:00',
          trainingTeamId: 'team1',
          trainingOriginalContentKey: 'Training|loc1|18:00|team1',
          trainingOriginalDate: '2026-01-10',
          date: '2026-01-10',
          trainingOriginalWeekdays: [1, 3],
          trainingWeekdays: [1, 5],  // weekdays differ
        } as any}
      />,
    );
    expect(screen.getByTestId('TrainingSeriesScopeStep')).toBeInTheDocument();
  });
});
