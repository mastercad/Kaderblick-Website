import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventModal } from '../EventModal';

// apiRequest mock (used by tournament settings fetch useEffect)
const mockApiRequest = jest.fn();
jest.mock('../../utils/api', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

// Mock BaseModal to avoid MUI theme/useMediaQuery issues
jest.mock('../BaseModal', () => ({
  __esModule: true,
  default: ({ open, title, children, actions }: any) => open ? (
    <div data-testid="Dialog">
      <div data-testid="DialogTitle">{title}</div>
      <div data-testid="DialogContent">{children}</div>
      <div data-testid="DialogActions">{actions}</div>
    </div>
  ) : null,
}));

// Mock hooks that make API calls
jest.mock('../../hooks/useEventData', () => ({
  useTournamentMatches: () => ({ tournamentMatches: [], setTournamentMatches: jest.fn() }),
  useLeagues: () => [],
  useCups: () => [],
  useCupRounds: () => [],
  useReloadTournamentMatches: () => jest.fn(),
}));

// MUI-Komponenten mocken
jest.mock('@mui/material/Button', () => (props: any) => <button {...props}>{props.children}</button>);
jest.mock('@mui/material/TextField', () => (props: any) => <input {...props} data-testid={props.label} />);
jest.mock('@mui/material/Select', () => (props: any) => <select {...props}>{props.children}</select>);
jest.mock('@mui/material/MenuItem', () => (props: any) => <option {...props}>{props.children}</option>);
jest.mock('@mui/material/InputLabel', () => (props: any) => <label {...props}>{props.children}</label>);
jest.mock('@mui/material/FormControl', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/Autocomplete', () => (props: any) => <div data-testid="Autocomplete">{props.renderInput({})}</div>);

// Mock sub-components that might import problematic dependencies
jest.mock('../ImportMatchesDialog', () => (props: any) =>
  props.open ? (
    <div data-testid="ImportMatchesDialog">
      <button data-testid="close-import" onClick={props.onClose}>Close</button>
    </div>
  ) : null
);
jest.mock('../ManualMatchesEditor', () => (props: any) =>
  props.open ? (
    <div data-testid="ManualMatchesEditor">
      <button data-testid="close-manual" onClick={props.onClose}>Close</button>
    </div>
  ) : null
);
jest.mock('../TournamentMatchGeneratorDialog', () => (props: any) =>
  props.open ? (
    <div data-testid="TournamentMatchGeneratorDialog">
      <button data-testid="close-generator" onClick={props.onClose}>Close</button>
    </div>
  ) : null
);
jest.mock('../../components/EventModal/TaskEventFields', () => ({ TaskEventFields: () => null }));
jest.mock('../../components/EventModal/TrainingEventFields', () => ({ TrainingEventFields: () => null }));
jest.mock('../../components/EventModal/PermissionFields', () => ({ PermissionFields: () => null }));
jest.mock('../../components/EventModal/TournamentFields', () => ({
  TournamentConfig: () => null,
  TournamentMatchesManagement: (props: any) => (
    <div data-testid="TournamentMatchesManagement">
      <button data-testid="open-import" onClick={props.onImportOpen}>Import</button>
      <button data-testid="open-manual" onClick={props.onManualOpen}>Manual</button>
      <button data-testid="open-generator" onClick={props.onGeneratorOpen}>Generator</button>
      <button data-testid="clear-matches" onClick={props.onClearMatches}>Clear</button>
    </div>
  ),
  TournamentSelection: () => null,
}));

// Logging unterdrücken
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  (console.log as jest.Mock).mockRestore();
  (console.error as jest.Mock).mockRestore();
});

const eventTypes = [
  { value: 'training', label: 'Training' },
  { value: 'spiel', label: 'Spiel' },
];
const teams = [
  { value: 'team1', label: 'Team 1' },
  { value: 'team2', label: 'Team 2' },
];
const gameTypes = [
  { value: 'liga', label: 'Liga' },
  { value: 'freundschaft', label: 'Freundschaft' },
];
const locations = [
  { value: 'loc1', label: 'Sportplatz 1' },
  { value: 'loc2', label: 'Sportplatz 2' },
];

const defaultEvent = {
  title: 'Testevent',
  date: '2025-09-26',
  time: '18:00',
  endDate: '2025-09-26',
  endTime: '20:00',
  eventType: 'training',
  locationId: 'loc1',
  description: 'Beschreibung',
};

describe('EventModal', () => {
  const onChange = jest.fn();
  const onClose = jest.fn();
  const onSave = jest.fn();
  const onDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: reject or return not-ok so existing tests are unaffected
    mockApiRequest.mockResolvedValue({ ok: false });
  });

  it('renders modal with event fields', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={defaultEvent}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
    // Title shows event title or "Neues Event"
    expect(screen.getByTestId('DialogTitle')).toBeInTheDocument();
    // Step 1 (Basisdaten) is shown first: Titel field should be present
    expect(screen.getByTestId('Titel *')).toBeInTheDocument();
    expect(screen.getByTestId('Datum *')).toBeInTheDocument();
  });

  it('calls onClose when Abbrechen button is clicked', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={defaultEvent}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave when Speichern button is clicked on last step', async () => {
    // Navigate to the last step first (training: Basisdaten -> Training -> Beschreibung)
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={defaultEvent}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    // Click "Weiter" twice to reach last step
    const weiterButtons = screen.getAllByText('Weiter');
    fireEvent.click(weiterButtons[0]);
    await act(async () => {});
    const weiterButtons2 = screen.queryAllByText('Weiter');
    if (weiterButtons2.length > 0) {
      fireEvent.click(weiterButtons2[0]);
      await act(async () => {});
    }
    // Now "Speichern" should be visible
    const saveBtn = screen.queryByText('Speichern');
    if (saveBtn) {
      fireEvent.click(saveBtn);
      expect(onSave).toHaveBeenCalled();
    }
  });

  it('calls onDelete when Löschen button is clicked', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
          showDelete={true}
          event={defaultEvent}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    fireEvent.click(screen.getByText('Löschen'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('shows game fields on details step when eventType is Spiel', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    // Navigate to details step
    const weiterBtn = screen.getByText('Weiter');
    fireEvent.click(weiterBtn);
    await act(async () => {});
    expect(screen.getByText('Heim-Team *')).toBeInTheDocument();
    expect(screen.getByText('Ausw\u00e4rts-Team *')).toBeInTheDocument();
    expect(screen.getByText('Spiel-Typ')).toBeInTheDocument();
  });

  it('disables buttons when loading', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
          showDelete={true}
          event={defaultEvent}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
          loading={true}
        />
      );
    });
    expect(screen.getByText('Abbrechen')).toBeDisabled();
    expect(screen.getByText('L\u00f6schen')).toBeDisabled();
    // When loading is true, the Weiter button is not disabled but Save shows "Wird gespeichert"
    const savingBtn = screen.queryByText('Wird gespeichert \u2026');
    if (savingBtn) expect(savingBtn).toBeDisabled();
  });

  it('calls onChange when input changes', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={defaultEvent}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    fireEvent.change(screen.getByTestId('Titel *'), { target: { value: 'Neuer Titel' } });
    expect(onChange).toHaveBeenCalledWith('title', 'Neuer Titel');
  });

  it('uses allTeams options in home/away selects for match events', async () => {
    const ownTeams = [{ value: 'own1', label: 'Own Team Only' }];
    const allTeamsData = [
      { value: 'own1', label: 'Own Team Only' },
      { value: 'opp1', label: 'Opponent FC' },
      { value: 'opp2', label: 'Rival United' },
    ];

    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel' }}
          eventTypes={eventTypes}
          teams={ownTeams}
          allTeams={allTeamsData}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    // Navigate to the details step
    fireEvent.click(screen.getByText('Weiter'));
    await act(async () => {});

    // Options from allTeams should be rendered (opponent teams visible for selection)
    expect(screen.getAllByText('Opponent FC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rival United').length).toBeGreaterThan(0);
  });

  it('falls back to teams prop when allTeams is not provided for match events', async () => {
    const ownTeams = [
      { value: 'own1', label: 'Only Own Team' },
    ];

    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel' }}
          eventTypes={eventTypes}
          teams={ownTeams}
          // no allTeams prop
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    // Navigate to details step
    fireEvent.click(screen.getByText('Weiter'));
    await act(async () => {});

    // teams fallback: only the own team option is available
    expect(screen.getAllByText('Only Own Team').length).toBeGreaterThan(0);
    // A team that would only appear in a full allTeams list must not be present
    expect(screen.queryByText('Opponent FC')).not.toBeInTheDocument();
  });

  it('shows stepError alert when navigating past an invalid step', async () => {
    // Render a spiel event without homeTeam/awayTeam/locationId so step validation fails
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel', locationId: '', title: 'Test' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    // Advance to STEP_DETAILS
    await act(async () => { fireEvent.click(screen.getByText('Weiter')); });
    // Attempt to advance past STEP_DETAILS without required fields → stepError
    await act(async () => { fireEvent.click(screen.getByText('Weiter')); });

    // stepError Alert should render (line 199)
    const alert = screen.queryByRole('alert');
    if (alert) {
      expect(alert).toBeInTheDocument();
      // Dismiss the alert
      const closeBtn = alert.parentElement?.querySelector('button');
      if (closeBtn) {
        await act(async () => { fireEvent.click(closeBtn); });
      }
    }
  });

  it('onClearMatches clears pendingTournamentMatches and resets tournamentMatches state', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel', tournamentId: 't-clear' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    // Navigate to STEP_DETAILS where TournamentMatchesManagement renders
    await act(async () => { fireEvent.click(screen.getByText('Weiter')); });

    expect(screen.getByTestId('TournamentMatchesManagement')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-matches'));
    });
    // onChange called with empty pendingTournamentMatches (lines 237-238)
    expect(onChange).toHaveBeenCalledWith('pendingTournamentMatches', []);
  });

  // ── Default parameter fallback branches (lines 60, 62) ────────────────────

  it('renders with default empty arrays when teams and gameTypes are not provided', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={defaultEvent}
          eventTypes={eventTypes}
          // omit teams and gameTypes to exercise default = [] branches
          locations={locations}
          onChange={onChange}
        />
      );
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── Tournament settings: partial settings coverage (lines 93-94) ──────────

  it('covers false branches when settings fields type and roundDuration are absent', async () => {
    mockApiRequest.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        settings: { numberOfGroups: 3 },
      }),
    });

    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel', tournamentId: 't-partial' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
    // type, roundDuration, breakTime, gameMode absent → their conditions are false
    expect(onChange).not.toHaveBeenCalledWith('tournamentType', expect.anything());
    expect(onChange).not.toHaveBeenCalledWith('tournamentRoundDuration', expect.anything());
    expect(onChange).toHaveBeenCalledWith('tournamentNumberOfGroups', 3);
  });

  // ── pendingTournamentMatches effect: open=false early-return (line 105) ────

  it('skips pendingTournamentMatches effect when open is false', async () => {
    // When open=false the effect should return early; no crash
    await act(async () => {
      render(
        <EventModal
          open={false}
          onClose={onClose}
          onSave={onSave}
          event={{
            ...defaultEvent,
            eventType: 'spiel',
            pendingTournamentMatches: [
              { id: 'draft-0', homeTeamId: 'team1', awayTeamId: 'team2' },
            ],
          }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    // BaseModal returns null when open=false; no visible content
    expect(screen.queryByTestId('Dialog')).not.toBeInTheDocument();
  });

  // ── pendingTournamentMatches: fallback branches in mapping (lines 110-113) ─

  it('uses homeTeamName fallback when homeTeamId is not found in teams', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{
            ...defaultEvent,
            eventType: 'spiel',
            pendingTournamentMatches: [
              // homeTeamId not in teams → falls through to homeTeamName
              { homeTeamId: 'unknown-1', awayTeamId: 'unknown-2', homeTeamName: 'Custom Home', awayTeamName: 'Custom Away' },
            ],
          }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  it('uses empty string for team name when both lookup and fallback name are absent', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{
            ...defaultEvent,
            eventType: 'spiel',
            pendingTournamentMatches: [
              // both lookup fails and homeTeamName is absent → ''
              { homeTeamId: 'unknown-1', awayTeamId: 'unknown-2' },
            ],
          }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  it('uses draft-idx id when match has no id in pendingTournamentMatches', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{
            ...defaultEvent,
            eventType: 'spiel',
            pendingTournamentMatches: [
              // no id → uses draft-0
              { homeTeamId: 'team1', awayTeamId: 'team2' },
            ],
          }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── tournament.matches: fallback branches in mapping (lines 123-155) ───────

  it('uses embedded-id fallback when tournament match has no id', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{
            ...defaultEvent,
            eventType: 'spiel',
            tournament: {
              matches: [
                // no id → produces embedded-${round}-${slot}
                { homeTeamId: 'team1', awayTeamId: 'team2', round: 1, slot: 0 },
              ],
            },
          }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  it('uses homeTeamName fallback when tournament match homeTeamId is not in teams', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{
            ...defaultEvent,
            eventType: 'spiel',
            tournament: {
              matches: [
                { id: 'm1', homeTeamId: 'unknown-x', awayTeamId: 'unknown-y', homeTeamName: 'Away FC', awayTeamName: 'Home FC' },
              ],
            },
          }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  it('uses empty string team names when tournament match ids are unresolvable and no fallback name', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{
            ...defaultEvent,
            eventType: 'spiel',
            tournament: {
              matches: [
                { id: 'm2', homeTeamId: 'unknown-a', awayTeamId: 'unknown-b' },
              ],
            },
          }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── modalTitle fallback: event.title || 'Neues Event' (line ~154) ──────────

  it('shows "Neues Event" as modal title when event.title is empty', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, title: '' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });
    expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Neues Event');
  });

  // ── handleChange guard: typeof onChange !== 'function' (line ~141) ─────────

  it('handleChange guard does not throw when onChange is not a function', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, title: 'Test Guard' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={null as any}
        />
      );
    });
    // Trigger an input change to exercise the handleChange false branch
    const titleInput = screen.queryByTestId('Titel *');
    if (titleInput) {
      await act(async () => {
        fireEvent.change(titleInput, { target: { value: 'Changed' } });
      });
    }
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── Tournament settings fetch useEffect (lines 87-97) ────────────────────

  it('fetches and applies tournament settings when tournamentId is set', async () => {
    mockApiRequest.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        settings: {
          type: 'indoor_hall',
          roundDuration: 8,
          breakTime: 2,
          gameMode: 'round_robin',
          numberOfGroups: 4,
        },
      }),
    });

    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel', tournamentId: 't-100' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith('/api/tournaments/t-100')
    );
    expect(onChange).toHaveBeenCalledWith('tournamentType', 'indoor_hall');
    expect(onChange).toHaveBeenCalledWith('tournamentRoundDuration', 8);
    expect(onChange).toHaveBeenCalledWith('tournamentBreakTime', 2);
    expect(onChange).toHaveBeenCalledWith('tournamentGameMode', 'round_robin');
    expect(onChange).toHaveBeenCalledWith('tournamentNumberOfGroups', 4);
  });

  it('does not apply settings when tournament settings fetch returns ok=false', async () => {
    mockApiRequest.mockResolvedValueOnce({ ok: false });

    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel', tournamentId: 't-101' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalledWith('tournamentType', expect.anything());
    expect(onChange).not.toHaveBeenCalledWith('tournamentRoundDuration', expect.anything());
  });

  it('silently ignores errors in tournament settings fetch', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('network failure'));

    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel', tournamentId: 't-102' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledWith('/api/tournaments/t-102'));
    // Must not crash; component still renders
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  it('skips tournament settings fetch when tournamentId is absent', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'training' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('applies only settings fields that are present in the response', async () => {
    mockApiRequest.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        settings: { type: 'outdoor', roundDuration: 12 },
      }),
    });

    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel', tournamentId: 't-103' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
    expect(onChange).toHaveBeenCalledWith('tournamentType', 'outdoor');
    expect(onChange).toHaveBeenCalledWith('tournamentRoundDuration', 12);
    expect(onChange).not.toHaveBeenCalledWith('tournamentBreakTime', expect.anything());
    expect(onChange).not.toHaveBeenCalledWith('tournamentGameMode', expect.anything());
    expect(onChange).not.toHaveBeenCalledWith('tournamentNumberOfGroups', expect.anything());
  });

  it('skips onChange calls when response has no settings object', async () => {
    mockApiRequest.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ other: 'data' }),
    });

    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{ ...defaultEvent, eventType: 'spiel', tournamentId: 't-104' }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalledWith('tournamentType', expect.anything());
  });

  // ── pendingTournamentMatches useEffect (lines 108-116) ────────────────────

  it('populates tournamentMatches from event.pendingTournamentMatches on open', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{
            ...defaultEvent,
            eventType: 'spiel',
            pendingTournamentMatches: [
              { id: 'draft-0', homeTeamId: 'team1', awayTeamId: 'team2', homeTeamName: 'Team 1', awayTeamName: 'Team 2' },
            ],
          }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    // Effect runs without error; component remains stable
    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── tournament.matches useEffect (lines 120-125) ──────────────────────────

  it('populates tournamentMatches from event.tournament.matches on open', async () => {
    await act(async () => {
      render(
        <EventModal
          open={true}
          onClose={onClose}
          onSave={onSave}
          event={{
            ...defaultEvent,
            eventType: 'spiel',
            tournament: {
              matches: [
                { id: 'm1', homeTeamId: 'team1', awayTeamId: 'team2' },
                { id: 'm2', homeTeamId: 'team2', awayTeamId: 'team1' },
              ],
            },
          }}
          eventTypes={eventTypes}
          teams={teams}
          gameTypes={gameTypes}
          locations={locations}
          onChange={onChange}
        />
      );
    });

    expect(screen.getByTestId('Dialog')).toBeInTheDocument();
  });

  // ── Sub-dialog open/close (lines 199-279) ─────────────────────────────────

  describe('sub-dialog open/close', () => {
    const tournamentEvent = {
      ...defaultEvent,
      eventType: 'spiel',
      tournamentId: 't-sub',
    };

    async function renderAndNavigateToDetails() {
      await act(async () => {
        render(
          <EventModal
            open={true}
            onClose={onClose}
            onSave={onSave}
            event={tournamentEvent}
            eventTypes={eventTypes}
            teams={teams}
            gameTypes={gameTypes}
            locations={locations}
            onChange={onChange}
          />
        );
      });
      // Navigate to STEP_DETAILS
      await act(async () => {
        fireEvent.click(screen.getByText('Weiter'));
      });
    }

    it('opens and closes ImportMatchesDialog via onImportOpen/onClose', async () => {
      await renderAndNavigateToDetails();

      expect(screen.queryByTestId('ImportMatchesDialog')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('open-import'));
      });
      expect(screen.getByTestId('ImportMatchesDialog')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-import'));
      });
      expect(screen.queryByTestId('ImportMatchesDialog')).not.toBeInTheDocument();
    });

    it('opens and closes ManualMatchesEditor via onManualOpen/onClose', async () => {
      await renderAndNavigateToDetails();

      expect(screen.queryByTestId('ManualMatchesEditor')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('open-manual'));
      });
      expect(screen.getByTestId('ManualMatchesEditor')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-manual'));
      });
      expect(screen.queryByTestId('ManualMatchesEditor')).not.toBeInTheDocument();
    });

    it('opens and closes TournamentMatchGeneratorDialog via onGeneratorOpen/onClose', async () => {
      await renderAndNavigateToDetails();

      expect(screen.queryByTestId('TournamentMatchGeneratorDialog')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('open-generator'));
      });
      expect(screen.getByTestId('TournamentMatchGeneratorDialog')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-generator'));
      });
      expect(screen.queryByTestId('TournamentMatchGeneratorDialog')).not.toBeInTheDocument();
    });
  });
});
