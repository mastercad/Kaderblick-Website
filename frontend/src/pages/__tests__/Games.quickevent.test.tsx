/**
 * Tests for Games.tsx – supporter-gate logic on "Spielereignis erfassen".
 *
 * Covered:
 *  - ROLE_SUPERADMIN: button click proceeds to fetchGameDetails (no modal)
 *  - ROLE_SUPPORTER:  button click proceeds to fetchGameDetails (no modal)
 *  - isCoach=true:    button click proceeds to fetchGameDetails (no modal)
 *  - ROLE_USER only:  button click opens SupporterApplicationModal
 *  - SupporterApplicationModal can be closed (onClose)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// ── window.matchMedia ─────────────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// ── Services ──────────────────────────────────────────────────────────────────

const mockFetchGamesOverview = jest.fn();
const mockFetchGameDetails   = jest.fn();

jest.mock('../../services/games', () => ({
  fetchGamesOverview:   (...a: any[]) => mockFetchGamesOverview(...a),
  fetchGameDetails:     (...a: any[]) => mockFetchGameDetails(...a),
  fetchGameSchedulePdf: jest.fn().mockResolvedValue(new Blob()),
}));

// ── Auth ──────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Routing ───────────────────────────────────────────────────────────────────

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

// ── Heavy UI components ───────────────────────────────────────────────────────

jest.mock('../../context/ToastContext', () => ({
  ToastProvider: ({ children }: any) => <>{children}</>,
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('../../modals/quick-event/components/QuickEventPanel', () => ({
  QuickEventPanel: ({ onClose }: any) => (
    <div data-testid="quick-event-panel">
      <button onClick={onClose}>Close Panel</button>
    </div>
  ),
}));

jest.mock('../../modals/quick-event/useQuickEventConfig', () => ({
  useQuickEventConfig: () => ({ config: null }),
}));

jest.mock('../../modals/SupporterApplicationModal', () => ({
  SupporterApplicationModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="supporter-modal">
        <button onClick={onClose}>CloseSupporterModal</button>
      </div>
    ) : null,
}));

jest.mock('../../modals/WeatherModal', () => () => null);
jest.mock('../../components/Location', () => () => null);
jest.mock('../../components/WeatherIcons', () => ({ WeatherDisplay: () => null }));
jest.mock('../../components/EmptyStateHint', () => ({ title }: any) => (
  <div data-testid="empty-state">{title}</div>
));
jest.mock('../PosterGenerator/components/SharePosterButton', () => ({
  SharePosterButton: () => null,
}));

jest.mock('../../utils/formatter', () => ({
  formatDateTime: () => '',
  formatTime: () => '',
}));

// ── Import under test ─────────────────────────────────────────────────────────

import Games from '../Games';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RUNNING_GAME = {
  id: 5,
  homeTeam: { id: 1, name: 'FC Heimat' },
  awayTeam: { id: 2, name: 'FC Gast' },
  isFinished: false,
  calendarEvent: {
    id: 10,
    startDate: new Date(Date.now() - 3600_000).toISOString(), // 1 hour ago → "running"
    endDate: new Date(Date.now() + 3600_000).toISOString(),
  },
  permissions: {},
};

const OVERVIEW_DATA = {
  running_games: [RUNNING_GAME],
  upcoming_games: [],
  finished_games: [],
  tournaments: [],
  userTeamIds: [1],
  userDefaultTeamId: 1,
  availableTeams: [{ id: 1, name: 'Team 1' }],
  availableSeasons: [2025],
  selectedSeason: 2025,
};

function makeUser(overrides: Record<string, unknown> = {}) {
  const roles: Record<string, string> = { ROLE_USER: 'ROLE_USER' };
  if (overrides.roleSupporter) roles['ROLE_SUPPORTER'] = 'ROLE_SUPPORTER';
  if (overrides.roleSuperAdmin) roles['ROLE_SUPERADMIN'] = 'ROLE_SUPERADMIN';
  return {
    id: 10,
    roles,
    isCoach: overrides.isCoach ?? false,
  };
}

function renderGames() {
  return render(
    <MemoryRouter>
      <Games />
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Games – Spielereignis erfassen button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchGamesOverview.mockResolvedValue(OVERVIEW_DATA);
    // fetchGameDetails never resolves by default, just to not throw
    mockFetchGameDetails.mockReturnValue(new Promise(() => {}));
  });

  it('proceeds to fetchGameDetails for ROLE_SUPERADMIN', async () => {
    mockUseAuth.mockReturnValue({ user: makeUser({ roleSuperAdmin: true }) });
    renderGames();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /spielereignis erfassen/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /spielereignis erfassen/i }));
    await waitFor(() => {
      expect(mockFetchGameDetails).toHaveBeenCalledWith(RUNNING_GAME.id);
    });
    expect(screen.queryByTestId('supporter-modal')).not.toBeInTheDocument();
  });

  it('proceeds to fetchGameDetails for ROLE_SUPPORTER', async () => {
    mockUseAuth.mockReturnValue({ user: makeUser({ roleSupporter: true }) });
    renderGames();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /spielereignis erfassen/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /spielereignis erfassen/i }));
    await waitFor(() => {
      expect(mockFetchGameDetails).toHaveBeenCalledWith(RUNNING_GAME.id);
    });
    expect(screen.queryByTestId('supporter-modal')).not.toBeInTheDocument();
  });

  it('proceeds to fetchGameDetails for isCoach=true', async () => {
    mockUseAuth.mockReturnValue({ user: makeUser({ isCoach: true }) });
    renderGames();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /spielereignis erfassen/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /spielereignis erfassen/i }));
    await waitFor(() => {
      expect(mockFetchGameDetails).toHaveBeenCalledWith(RUNNING_GAME.id);
    });
    expect(screen.queryByTestId('supporter-modal')).not.toBeInTheDocument();
  });

  it('opens SupporterApplicationModal for ROLE_USER without coach or supporter', async () => {
    mockUseAuth.mockReturnValue({ user: makeUser() }); // plain ROLE_USER, no coach
    renderGames();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /spielereignis erfassen/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /spielereignis erfassen/i }));
    await waitFor(() => {
      expect(screen.getByTestId('supporter-modal')).toBeInTheDocument();
    });
    expect(mockFetchGameDetails).not.toHaveBeenCalled();
  });

  it('SupporterApplicationModal can be closed', async () => {
    mockUseAuth.mockReturnValue({ user: makeUser() });
    renderGames();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /spielereignis erfassen/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /spielereignis erfassen/i }));
    await waitFor(() => expect(screen.getByTestId('supporter-modal')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'CloseSupporterModal' }));
    await waitFor(() => {
      expect(screen.queryByTestId('supporter-modal')).not.toBeInTheDocument();
    });
  });
});
