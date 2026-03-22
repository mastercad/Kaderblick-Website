import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RegistrationContextDialog from '../../modals/RegistrationContextDialog';

// ────── MUI Mock ──────
jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material');
  return {
    ...actual,
    Dialog: (props: any) => props.open ? <div data-testid="Dialog">{props.children}</div> : null,
    DialogTitle: (props: any) => <h2 data-testid="DialogTitle">{props.children}</h2>,
    DialogContent: (props: any) => <div data-testid="DialogContent">{props.children}</div>,
    DialogActions: (props: any) => <div data-testid="DialogActions">{props.children}</div>,
    Button: (props: any) => (
      <button
        data-testid={props['data-testid'] || undefined}
        onClick={props.onClick}
        disabled={props.disabled}
      >
        {props.children}
      </button>
    ),
    IconButton: (props: any) => (
      <button onClick={props.onClick} aria-label={props['aria-label']}>{props.children}</button>
    ),
    Box: (props: any) => <div>{props.children}</div>,
    Typography: (props: any) => <span>{props.children}</span>,
    CircularProgress: (props: any) =>
      props.size ? <span data-testid="CircularProgress-inline" /> : <div data-testid="CircularProgress" />,
    Alert: (props: any) => <div data-testid="Alert" role="alert">{props.children}</div>,
    Stepper: (props: any) => <div data-testid="Stepper">{props.children}</div>,
    Step: (props: any) => <div data-testid="Step">{props.children}</div>,
    StepLabel: (props: any) => <span data-testid="StepLabel">{props.children}</span>,
    ToggleButtonGroup: (props: any) => (
      <div data-testid="ToggleButtonGroup" data-value={props.value}>
        {React.Children.map(props.children, (child: any) =>
          child ? React.cloneElement(child, { onChange: props.onChange }) : child
        )}
      </div>
    ),
    ToggleButton: (props: any) => (
      <button
        data-testid={`toggle-${props.value}`}
        onClick={(e) => props.onChange?.(e, props.value)}
      >
        {props.children}
      </button>
    ),
    // Autocomplete: renders a search input + options list.
    // Fixes the params.InputProps.endAdornment crash by passing InputProps correctly.
    Autocomplete: (props: any) => (
      <div data-testid="Autocomplete">
        {props.renderInput({
          inputProps: {},
          InputLabelProps: {},
          InputProps: { endAdornment: null },
        })}
        {/* Separate controlled input for triggering onInputChange in tests */}
        <input
          data-testid="autocomplete-search"
          value={props.inputValue ?? ''}
          onChange={(e) => props.onInputChange?.(e, e.target.value, 'input')}
        />
        {props.options?.map((o: any) => (
          <div
            key={o.id}
            data-testid={`autocomplete-option-${o.id}`}
            onClick={() => props.onChange?.(null, o)}
          >
            {props.renderOption
              ? props.renderOption({}, o)
              : props.getOptionLabel(o)}
          </div>
        ))}
      </div>
    ),
    TextField: (props: any) => (
      <input
        data-testid={props['data-testid'] || 'TextField'}
        placeholder={props.placeholder ?? props.label}
        value={props.value ?? ''}
        onChange={(e) => props.onChange?.(e)}
        {...(props.inputProps || {})}
      />
    ),
    Stack: (props: any) => <div>{props.children}</div>,
    Paper: (props: any) => (
      <div
        data-testid="Paper"
        onClick={props.onClick}
        style={{ cursor: props.onClick ? 'pointer' : undefined }}
      >
        {props.children}
      </div>
    ),
    Chip: (props: any) => <span data-testid="Chip">{props.label}</span>,
  };
});

jest.mock('@mui/icons-material/Person', () => () => <span>PersonIcon</span>);
jest.mock('@mui/icons-material/SportsSoccer', () => () => <span>SportsSoccerIcon</span>);
jest.mock('@mui/icons-material/CheckCircleOutline', () => () => <span data-testid="CheckCircleOutlineIcon">✓</span>);
jest.mock('@mui/icons-material/Close', () => () => null);

// ────── API Mock ──────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ────── Fixtures ──────

// Regression: /context no longer returns players/coaches (bulk load removed).
// Only relationTypes is in the response.
const mockContextData = {
  relationTypes: [
    { id: 1, identifier: 'parent',      name: 'Elternteil',       category: 'player' },
    { id: 2, identifier: 'self_player', name: 'Spieler selbst',   category: 'player' },
    { id: 3, identifier: 'self_coach',  name: 'Trainer selbst',   category: 'coach' },
  ],
};

const mockSearchResultsPlayer = {
  results: [
    { id: 1, fullName: 'Max Mustermann', teams: ['U17', 'U15'] },
    { id: 2, fullName: 'Anna Schmidt' },
  ],
};

const mockSearchResultsCoach = {
  results: [
    { id: 10, fullName: 'Hans Trainer', teams: ['1. Mannschaft'] },
  ],
};

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

beforeEach(() => {
  jest.useFakeTimers();
  mockApiJson.mockReset();
  mockApiJson.mockImplementation((url: string) => {
    if (url === '/api/registration-request/context') {
      return Promise.resolve(mockContextData);
    }
    if (url.includes('/context/search?type=player')) {
      return Promise.resolve(mockSearchResultsPlayer);
    }
    if (url.includes('/context/search?type=coach')) {
      return Promise.resolve(mockSearchResultsCoach);
    }
    if (url === '/api/registration-request') {
      return Promise.resolve({ message: 'Antrag eingereicht' });
    }
    return Promise.resolve({});
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Shared navigation helpers ──────────────────────────────────────────────

/** Navigate to step 1 (entity search). Does NOT yet select anything. */
const navigateToStep1 = async (type: 'player' | 'coach' = 'player') => {
  await act(async () => {
    render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
  });
  await waitFor(() => screen.getByTestId('Stepper'));
  await act(async () => { fireEvent.click(screen.getByTestId(`toggle-${type}`)); });
  await act(async () => { fireEvent.click(screen.getByText('Weiter')); });
  await waitFor(() => screen.getByTestId('Autocomplete'));
};

/**
 * Trigger the search debounce and wait for results to appear.
 * Uses the `autocomplete-search` input exposed by the Autocomplete mock.
 */
const triggerSearch = async (query: string) => {
  await act(async () => {
    fireEvent.change(screen.getByTestId('autocomplete-search'), { target: { value: query } });
    jest.advanceTimersByTime(350);
  });
};

/** Go to step 1, search, then click the given option id. */
const selectPlayer = async (optionId: number) => {
  await triggerSearch('Ma');
  await waitFor(() => screen.getByTestId(`autocomplete-option-${optionId}`));
  await act(async () => { fireEvent.click(screen.getByTestId(`autocomplete-option-${optionId}`)); });
};

/** Navigate all the way to step 2 (relation type selection). */
const navigateToStep2 = async () => {
  await navigateToStep1('player');
  await selectPlayer(1);
  await act(async () => { fireEvent.click(screen.getByText('Weiter')); });
};

/** Navigate to step 3 (summary). */
const navigateToStep3 = async () => {
  await navigateToStep2();
  await act(async () => { fireEvent.click(screen.getByText('Elternteil')); });
  await act(async () => { fireEvent.click(screen.getByText('Weiter')); });
};

// ────── Tests ──────

describe('RegistrationContextDialog', () => {

  // ── Regression: bulk load removed ─────────────────────────────────────────
  describe('Regression – context response has no players/coaches', () => {
    it('context endpoint does NOT return players or coaches keys', async () => {
      let captured: any;
      mockApiJson.mockImplementation((url: string) => {
        if (url === '/api/registration-request/context') {
          captured = mockContextData;
          return Promise.resolve(mockContextData);
        }
        return Promise.resolve({ results: [] });
      });

      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });
      await waitFor(() => screen.getByTestId('Stepper'));

      expect(captured).not.toHaveProperty('players');
      expect(captured).not.toHaveProperty('coaches');
      expect(captured).toHaveProperty('relationTypes');
    });

    it('does NOT call /context/search on mount', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });
      await waitFor(() => screen.getByTestId('Stepper'));
      await act(async () => { jest.runAllTimers(); });

      const searchCalls = mockApiJson.mock.calls.filter(
        ([url]: [string]) => url.includes('/context/search')
      );
      expect(searchCalls).toHaveLength(0);
    });
  });

  describe('Visibility', () => {
    it('renders nothing when open=false', () => {
      render(<RegistrationContextDialog open={false} onClose={jest.fn()} />);
      expect(screen.queryByTestId('Dialog')).not.toBeInTheDocument();
    });

    it('renders dialog when open=true', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });
      expect(screen.getByTestId('Dialog')).toBeInTheDocument();
    });

    it('shows title when open', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });
      expect(screen.getByTestId('DialogTitle')).toHaveTextContent('Meine Vereinszugehörigkeit angeben');
    });
  });

  describe('Loading / Context fetch', () => {
    it('shows loading spinner while fetching context', async () => {
      let resolveContext: (v: any) => void;
      mockApiJson.mockReturnValue(new Promise((res) => { resolveContext = res; }));

      render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);

      expect(screen.getByTestId('CircularProgress')).toBeInTheDocument();

      await act(async () => resolveContext!(mockContextData));
    });

    it('calls context API on open', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith('/api/registration-request/context');
      });
    });

    it('shows stepper after context loaded', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('Stepper')).toBeInTheDocument();
      });
    });

    it('shows 4 step labels', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });

      await waitFor(() => {
        const stepLabels = screen.getAllByTestId('StepLabel');
        expect(stepLabels).toHaveLength(4);
      });
    });

    it('shows error alert when context API fails', async () => {
      mockApiJson.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });

      await waitFor(() => {
        const alert = screen.getByTestId('Alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent('Daten konnten nicht geladen werden.');
      });
    });
  });

  describe('Überspringen button (skip)', () => {
    it('renders Überspringen button', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });

      await waitFor(() => screen.getByTestId('Stepper'));

      expect(screen.getByText('Überspringen')).toBeInTheDocument();
    });

    it('calls onClose when Überspringen is clicked', async () => {
      const onClose = jest.fn();

      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={onClose} />);
      });

      await waitFor(() => screen.getByTestId('Stepper'));

      fireEvent.click(screen.getByText('Überspringen'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Step 0 – Player/Coach selection', () => {
    it('shows ToggleButtonGroup with player and coach options', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });

      await waitFor(() => screen.getByTestId('Stepper'));

      expect(screen.getByTestId('toggle-player')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-coach')).toBeInTheDocument();
    });

    it('Weiter button is disabled until a type is selected', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });

      await waitFor(() => screen.getByTestId('Stepper'));

      const weiterBtn = screen.getByText('Weiter');
      expect(weiterBtn).toBeDisabled();
    });

    it('Weiter button becomes enabled after selecting Player', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });

      await waitFor(() => screen.getByTestId('Stepper'));

      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-player'));
      });

      const weiterBtn = screen.getByText('Weiter');
      expect(weiterBtn).not.toBeDisabled();
    });

    it('Weiter button becomes enabled after selecting Coach', async () => {
      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={jest.fn()} />);
      });

      await waitFor(() => screen.getByTestId('Stepper'));

      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-coach'));
      });

      const weiterBtn = screen.getByText('Weiter');
      expect(weiterBtn).not.toBeDisabled();
    });
  });

  describe('Step 1 – Entity search (search-as-you-type)', () => {
    it('shows Autocomplete for entity selection', async () => {
      await navigateToStep1();
      expect(screen.getByTestId('Autocomplete')).toBeInTheDocument();
    });

    it('Weiter is disabled until a player is selected', async () => {
      await navigateToStep1();
      expect(screen.getByText('Weiter')).toBeDisabled();
    });

    it('shows Zurück button on step 1', async () => {
      await navigateToStep1();
      expect(screen.getByText('Zurück')).toBeInTheDocument();
    });

    it('does not trigger search when input has only 1 character', async () => {
      await navigateToStep1();
      const callsBefore = mockApiJson.mock.calls.length;

      await act(async () => {
        fireEvent.change(screen.getByTestId('autocomplete-search'), { target: { value: 'M' } });
        jest.advanceTimersByTime(350);
      });

      const searchCalls = mockApiJson.mock.calls
        .slice(callsBefore)
        .filter(([url]: [string]) => url.includes('/context/search'));
      expect(searchCalls).toHaveLength(0);
    });

    it('triggers search with type=player after typing ≥2 characters', async () => {
      await navigateToStep1('player');
      const callsBefore = mockApiJson.mock.calls.length;

      await triggerSearch('Ma');

      const searchCalls = mockApiJson.mock.calls
        .slice(callsBefore)
        .filter(([url]: [string]) => url.includes('/context/search'));
      expect(searchCalls).toHaveLength(1);
      expect(searchCalls[0][0]).toContain('type=player');
      expect(searchCalls[0][0]).toContain('q=Ma');
    });

    it('shows player options after successful search', async () => {
      await navigateToStep1();
      await triggerSearch('Ma');

      await waitFor(() => {
        expect(screen.getByTestId('autocomplete-option-1')).toBeInTheDocument();
        expect(screen.getByTestId('autocomplete-option-2')).toBeInTheDocument();
      });
    });

    it('Weiter is enabled after selecting a player from search results', async () => {
      await navigateToStep1();
      await selectPlayer(1);

      expect(screen.getByText('Weiter')).not.toBeDisabled();
    });
  });

  describe('Step 2 – Relation type selection', () => {
    it('shows player relation types as clickable Papers', async () => {
      await navigateToStep2();
      expect(screen.getByText('Elternteil')).toBeInTheDocument();
      expect(screen.getByText('Spieler selbst')).toBeInTheDocument();
    });

    it('does not show coach relation types on player step', async () => {
      await navigateToStep2();
      expect(screen.queryByText('Trainer selbst')).not.toBeInTheDocument();
    });

    it('Weiter is disabled until a relation type is selected', async () => {
      await navigateToStep2();
      expect(screen.getByText('Weiter')).toBeDisabled();
    });

    it('Weiter is enabled after selecting a relation type', async () => {
      await navigateToStep2();

      await act(async () => {
        fireEvent.click(screen.getByText('Elternteil'));
      });

      expect(screen.getByText('Weiter')).not.toBeDisabled();
    });
  });

  describe('Step 3 – Summary and submit', () => {
    it('shows "Antrag stellen" submit button on step 3', async () => {
      await navigateToStep3();
      expect(screen.getByText('Antrag stellen')).toBeInTheDocument();
    });

    it('shows summary with selected entity name', async () => {
      await navigateToStep3();
      expect(screen.getByText('Max Mustermann')).toBeInTheDocument();
    });

    it('shows summary with selected relation type', async () => {
      await navigateToStep3();
      expect(screen.getByText('Elternteil')).toBeInTheDocument();
    });

    it('submits request with correct payload', async () => {
      await navigateToStep3();

      await act(async () => {
        fireEvent.click(screen.getByText('Antrag stellen'));
      });

      await waitFor(() => {
        expect(mockApiJson).toHaveBeenCalledWith(
          '/api/registration-request',
          expect.objectContaining({
            method: 'POST',
            body: expect.objectContaining({
              entityType: 'player',
              entityId: 1,
              relationTypeId: 1,
            }),
          })
        );
      });
    });

    it('shows success state after successful submission', async () => {
      await navigateToStep3();

      await act(async () => {
        fireEvent.click(screen.getByText('Antrag stellen'));
      });

      await waitFor(() => {
        expect(screen.getByText('Antrag eingereicht!')).toBeInTheDocument();
      });
    });

    it('shows success Schließen button after submission', async () => {
      await navigateToStep3();

      await act(async () => {
        fireEvent.click(screen.getByText('Antrag stellen'));
      });

      await waitFor(() => {
        expect(screen.getByText('Schließen')).toBeInTheDocument();
      });
    });

    it('shows error alert when submission fails', async () => {
      mockApiJson.mockImplementation((url: string) => {
        if (url === '/api/registration-request/context')    return Promise.resolve(mockContextData);
        if (url.includes('/context/search?type=player'))    return Promise.resolve(mockSearchResultsPlayer);
        return Promise.reject(new Error('Network error'));
      });

      await navigateToStep3();

      await act(async () => {
        fireEvent.click(screen.getByText('Antrag stellen'));
      });

      await waitFor(() => {
        const alerts = screen.getAllByTestId('Alert');
        const hasError = alerts.some(a => a.textContent?.includes('Network error'));
        expect(hasError).toBe(true);
      });
    });

    it('shows error alert when API returns error field', async () => {
      mockApiJson.mockImplementation((url: string) => {
        if (url === '/api/registration-request/context')    return Promise.resolve(mockContextData);
        if (url.includes('/context/search?type=player'))    return Promise.resolve(mockSearchResultsPlayer);
        return Promise.resolve({ error: 'Du hast bereits einen offenen Antrag.' });
      });

      await navigateToStep3();

      await act(async () => {
        fireEvent.click(screen.getByText('Antrag stellen'));
      });

      await waitFor(() => {
        const alerts = screen.getAllByTestId('Alert');
        const errorAlert = alerts.find(a =>
          a.textContent?.includes('Du hast bereits einen offenen Antrag.')
        );
        expect(errorAlert).toBeDefined();
        expect(errorAlert).toHaveTextContent('Du hast bereits einen offenen Antrag.');
      });
    });

    it('Schließen calls onClose after successful submission', async () => {
      const onClose = jest.fn();

      await act(async () => {
        render(<RegistrationContextDialog open={true} onClose={onClose} />);
      });
      await waitFor(() => screen.getByTestId('Stepper'));
      await act(async () => { fireEvent.click(screen.getByTestId('toggle-player')); });
      await act(async () => { fireEvent.click(screen.getByText('Weiter')); });
      await waitFor(() => screen.getByTestId('Autocomplete'));
      await selectPlayer(1);
      await act(async () => { fireEvent.click(screen.getByText('Weiter')); });
      await act(async () => { fireEvent.click(screen.getByText('Elternteil')); });
      await act(async () => { fireEvent.click(screen.getByText('Weiter')); });

      await act(async () => { fireEvent.click(screen.getByText('Antrag stellen')); });
      await waitFor(() => screen.getByText('Schließen'));

      fireEvent.click(screen.getByText('Schließen'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ────── Team-Anzeige im Autocomplete ──────
  describe('Team-Anzeige im Autocomplete', () => {
    const navigateToPersonStepAndSearch = async (type: 'player' | 'coach' = 'player') => {
      await navigateToStep1(type);
      await triggerSearch('Ha');
      await waitFor(() =>
        screen.getByTestId(type === 'player' ? 'autocomplete-option-1' : 'autocomplete-option-10')
      );
    };

    it('zeigt Team-Namen in den renderOption-Inhalten für Spieler mit Teams', async () => {
      await navigateToPersonStepAndSearch('player');

      const option1 = screen.getByTestId('autocomplete-option-1');
      expect(option1).toHaveTextContent('Max Mustermann');
      expect(option1).toHaveTextContent('U17');
      expect(option1).toHaveTextContent('U15');
    });

    it('zeigt keine Team-Namen für Spieler ohne Teams', async () => {
      await navigateToPersonStepAndSearch('player');

      const option2 = screen.getByTestId('autocomplete-option-2');
      expect(option2).toHaveTextContent('Anna Schmidt');
      expect(option2.textContent).toBe('Anna Schmidt');
    });

    it('zeigt Team-Namen in renderOption für Coach-Typ', async () => {
      await navigateToPersonStepAndSearch('coach');

      const coachOption = screen.getByTestId('autocomplete-option-10');
      expect(coachOption).toHaveTextContent('Hans Trainer');
      expect(coachOption).toHaveTextContent('1. Mannschaft');
    });
  });
});
