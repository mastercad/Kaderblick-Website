import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CompetitionGamesModal } from '../CompetitionGamesModal';

// ── Module mocks ─────────────────────────────────────────────────────────

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson:    (...args: any[]) => mockApiJson(...args),
  apiRequest: jest.fn(),
}));
jest.mock('../../utils/buildLeagueCupPayload', () => ({
  buildLeagueCupPayload: jest.fn(() => ({ leagueId: null, cupId: null })),
}));

// Prevent the nested EventDetailsModal / EventModal from crashing tests
jest.mock('../EventDetailsModal', () => ({
  EventDetailsModal: () => null,
}));
jest.mock('../EventModal', () => ({
  EventModal: () => null,
}));
jest.mock('../../hooks/useCalendarEventDetails', () => ({
  useCalendarEventDetailsLoader: () => ({
    selectedEvent:  null,
    loadingEventId: null,
    openEventDetails:  jest.fn(),
    closeEventDetails: jest.fn(),
  }),
}));

// Minimal MUI stubs to keep rendering lightweight
jest.mock('@mui/material/Box',              () => (p: any) => <div>{p.children}</div>);
jest.mock('@mui/material/CircularProgress', () => () => <span data-testid="spinner" />);
jest.mock('@mui/material/List',             () => (p: any) => <ul>{p.children}</ul>);
jest.mock('@mui/material/ListItemButton',   () => (p: any) => <li onClick={p.onClick}>{p.children}</li>);
jest.mock('@mui/material/ListItemText',     () => (p: any) => <span>{p.primary}</span>);
jest.mock('@mui/material/Typography',       () => (p: any) => <span>{p.children}</span>);
jest.mock('@mui/material/Chip',             () => (p: any) => <span data-testid="chip">{p.label}</span>);
jest.mock('../BaseModal',                   () => (p: any) => p.open ? <div data-testid="base-modal">{p.children}</div> : null);
jest.mock('@mui/icons-material/Sports',     () => () => null);

// ── Helpers ──────────────────────────────────────────────────────────────

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  competitionId: 1,
  competitionName: 'Kreisliga A',
  competitionType: 'league' as const,
};

const twoGames = [
  { id: 10, homeTeamName: 'U19', awayTeamName: 'Erste',  homeScore: null, awayScore: null, isFinished: false, calendarEventId: 100, date: null },
  { id: 11, homeTeamName: 'Zweite', awayTeamName: 'U17', homeScore: 2,    awayScore: 1,    isFinished: true,  calendarEventId: 101, date: null },
];

// ── Tests ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockApiJson.mockResolvedValue({ games: twoGames });
});

describe('CompetitionGamesModal — game list', () => {
  it('renders the modal and loads games from the correct league endpoint', async () => {
    render(<CompetitionGamesModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/api/leagues/1/games');
    });
  });

  it('loads games from the cups endpoint when competitionType is "cup"', async () => {
    render(<CompetitionGamesModal {...defaultProps} competitionType="cup" />);

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/api/cups/1/games');
    });
  });

  it('renders game entries after loading', async () => {
    render(<CompetitionGamesModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/U19/)).toBeInTheDocument();
    });
  });

  it('does not load games when modal is closed', () => {
    render(<CompetitionGamesModal {...defaultProps} open={false} />);
    expect(mockApiJson).not.toHaveBeenCalled();
  });
});

describe('CompetitionGamesModal — onGamesChanged callback', () => {
  it('calls onGamesChanged with the game count after initial load', async () => {
    const onGamesChanged = jest.fn();

    render(<CompetitionGamesModal {...defaultProps} onGamesChanged={onGamesChanged} />);

    await waitFor(() => {
      expect(onGamesChanged).toHaveBeenCalledWith(2);
    });
  });

  it('calls onGamesChanged with 0 when the API returns an empty list', async () => {
    mockApiJson.mockResolvedValue({ games: [] });
    const onGamesChanged = jest.fn();

    render(<CompetitionGamesModal {...defaultProps} onGamesChanged={onGamesChanged} />);

    await waitFor(() => {
      expect(onGamesChanged).toHaveBeenCalledWith(0);
    });
  });

  it('does NOT cause an infinite re-request loop when onGamesChanged is an inline callback', async () => {
    // This is the regression test for the bug where an inline arrow function as
    // onGamesChanged triggered continuous re-renders and API calls.
    let callCount = 0;
    const onGamesChanged = jest.fn(() => { callCount += 1; });

    // Each call simulates a fresh render → new arrow function reference
    const { rerender } = render(
      <CompetitionGamesModal {...defaultProps} onGamesChanged={onGamesChanged} />,
    );
    // Simulate parent re-rendering with a new function reference (as happens with
    // inline arrows in Leagues.tsx / Cups.tsx)
    rerender(<CompetitionGamesModal {...defaultProps} onGamesChanged={jest.fn(() => { callCount += 1; })} />);
    rerender(<CompetitionGamesModal {...defaultProps} onGamesChanged={jest.fn(() => { callCount += 1; })} />);

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalled();
    });

    // Allow async queue to drain
    await act(async () => {});

    // API must have been called exactly once (on first open), NOT on every rerender.
    expect(mockApiJson).toHaveBeenCalledTimes(1);
  });
});
