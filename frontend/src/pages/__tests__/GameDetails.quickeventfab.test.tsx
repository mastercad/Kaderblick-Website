/**
 * Tests für die neue QuickEventFab in GameDetails.tsx.
 *
 * Die QuickEventFab (aria-label "Fernbedienung öffnen") verhält sich
 * anders als die bestehende Ereignis-FAB:
 *
 *  - Nur sichtbar wenn isGameRunning()=true (calendarEvent covers current time)
 *  - Nicht sichtbar wenn Spiel noch nicht / nicht mehr läuft
 *  - Klick bei can_create_game_events=true → öffnet QuickEventPanel
 *  - Klick bei can_create_game_events=false → öffnet SupporterApplicationModal
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// ── window.matchMedia (jsdom doesn't have it) ─────────────────────────────────
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

const mockFetchGameDetails = jest.fn();
const mockFetchGameEvents  = jest.fn();
const mockFetchVideos      = jest.fn();

jest.mock('../../services/games', () => ({
  fetchGameDetails: (...a: any[]) => mockFetchGameDetails(...a),
  fetchGameEvents:  (...a: any[]) => mockFetchGameEvents(...a),
  updateGameTiming: jest.fn(),
  deleteGameEvent:  jest.fn(),
  syncFussballDe:   jest.fn(),
  finishGame:       jest.fn(),
}));

jest.mock('../../services/videos', () => ({
  fetchVideos:  (...a: any[]) => mockFetchVideos(...a),
  saveVideo:    jest.fn(),
  deleteVideo:  jest.fn(),
}));

jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
  getApiErrorMessage: (e: any) => (e instanceof Error ? e.message : String(e)),
}));

// ── Auth ──────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Context providers ─────────────────────────────────────────────────────────

jest.mock('../../context/ToastContext', () => ({
  ToastProvider: ({ children }: any) => <>{children}</>,
  useToast: () => ({ showToast: jest.fn() }),
}));

// ── QuickEvent components ─────────────────────────────────────────────────────

jest.mock('../../modals/quick-event/useQuickEventConfig', () => ({
  useQuickEventConfig: () => ({ config: null }),
}));

jest.mock('../../modals/quick-event/components/QuickEventPanel', () => ({
  QuickEventPanel: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="quick-event-panel">
        <button onClick={onClose}>Panel schließen</button>
      </div>
    ) : null,
}));

// ── Modals & Components ───────────────────────────────────────────────────────

jest.mock('../../modals/VideoModal', () => ({ open }: any) =>
  open ? <div>VideoModalOpen</div> : null
);
jest.mock('../../modals/VideoPlayModal', () =>
  // eslint-disable-next-line react/display-name
  React.forwardRef(() => null)
);
jest.mock('../../modals/VideoSegmentModal', () => ({ VideoSegmentModal: () => null }));
jest.mock('../../modals/ConfirmationModal', () => ({
  ConfirmationModal: () => null,
}));
jest.mock('../../modals/GameEventModal', () => ({
  GameEventModal: ({ open }: any) => (open ? <div>GameEventModalOpen</div> : null),
}));
jest.mock('../../modals/WeatherModal', () => () => null);
jest.mock('../../modals/SupporterApplicationModal', () => ({
  SupporterApplicationModal: ({ open }: any) =>
    open ? <div data-testid="supporter-modal">SupporterApplicationModalOpen</div> : null,
}));
jest.mock('../../components/Location', () => () => null);
jest.mock('../../components/WeatherIcons', () => ({ WeatherDisplay: () => null }));
jest.mock('../../components/UserAvatar', () => ({ UserAvatar: () => null }));
jest.mock('../../components/GameMatchPlanCard', () => () => (
  <div data-testid="game-match-plan-card" />
));
jest.mock('../../components/EmptyStateHint', () => ({ title }: any) => (
  <div data-testid="empty-state-hint">{title}</div>
));
jest.mock('../../constants/gameEventIcons', () => ({ getGameEventIconByCode: () => null }));
jest.mock('../../utils/videoTimeline', () => ({ calculateCumulativeOffset: () => 0 }));
jest.mock('../../utils/formatter', () => ({
  formatEventTime: () => '0:00',
  formatDateTime: () => '',
}));
jest.mock('../../utils/avatarFrame', () => ({ getAvatarFrameUrl: () => '' }));
jest.mock('../PosterGenerator/components/SharePosterButton', () => ({
  SharePosterButton: () => null,
}));

// ── Component under test ──────────────────────────────────────────────────────

import GameDetails from '../GameDetails';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Returns ISO strings for a game that is currently running. */
const runningDates = () => ({
  startDate: new Date(Date.now() - 3_600_000).toISOString(), // 1 h ago
  endDate:   new Date(Date.now() + 3_600_000).toISOString(), // 1 h from now
});

/** Returns ISO strings for a game that ended in the past (not running). */
const pastDates = () => ({
  startDate: '2025-01-01T10:00:00Z',
  endDate:   '2025-01-01T12:00:00Z',
});

const makeGame = (
  permissions: Record<string, boolean | undefined> = {},
  gameOverrides: Record<string, unknown> = {}
) => ({
  id: 42,
  homeTeam: { id: 1, name: 'FC Home' },
  awayTeam: { id: 2, name: 'FC Away' },
  calendarEvent: { id: 10, ...runningDates() },
  isFinished: false,
  halfDuration: 45,
  halftimeBreakDuration: 15,
  firstHalfExtraTime: null,
  secondHalfExtraTime: null,
  permissions: {
    can_create_game_events: false,
    can_create_videos: false,
    can_finish_game: false,
    can_edit_timing: false,
    can_manage_match_plan: false,
    can_view_match_plan: false,
    ...permissions,
  },
  ...gameOverrides,
});

const makeResponse = (
  permissions: Record<string, boolean | undefined> = {},
  gameOverrides: Record<string, unknown> = {}
) => ({
  game: makeGame(permissions, gameOverrides),
  gameEvents: [],
  homeScore: 0,
  awayScore: 0,
});

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter initialEntries={['/games/42']}>{ui}</MemoryRouter>);

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  (console.log as jest.Mock).mockRestore();
  (console.error as jest.Mock).mockRestore();
  (console.warn as jest.Mock).mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 1, name: 'Testuser' } });
  mockFetchGameDetails.mockResolvedValue(makeResponse());
  mockFetchVideos.mockResolvedValue({ videos: [], youtubeLinks: [], videoTypes: [], cameras: [] });
  mockFetchGameEvents.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameDetails – QuickEventFab', () => {

  // ── Visibility ──────────────────────────────────────────────────────────────

  it('zeigt die Fernbedienung-FAB wenn das Spiel gerade läuft', async () => {
    mockFetchGameDetails.mockResolvedValueOnce(makeResponse());

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /fernbedienung öffnen/i })).toBeInTheDocument();
    });
  });

  it('zeigt die Fernbedienung-FAB auch wenn can_create_game_events=false (Supporter-Gate)', async () => {
    mockFetchGameDetails.mockResolvedValueOnce(
      makeResponse({ can_create_game_events: false })
    );

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /fernbedienung öffnen/i })).toBeInTheDocument();
    });
  });

  it('zeigt die Fernbedienung-FAB NICHT wenn das Spiel nicht läuft (vergangenes Datum)', async () => {
    mockFetchGameDetails.mockResolvedValueOnce(
      makeResponse({}, {
        calendarEvent: { id: 10, ...pastDates() },
        isFinished: true,
      })
    );

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    // Wait for the component to finish loading (the Add-Event FAB is always rendered)
    await screen.findByRole('button', { name: /ereignis erfassen/i });

    expect(screen.queryByRole('button', { name: /fernbedienung öffnen/i })).not.toBeInTheDocument();
  });

  // ── Click behavior: canCreateEvents = true ──────────────────────────────────

  it('öffnet das QuickEventPanel wenn can_create_game_events=true', async () => {
    mockFetchGameDetails.mockResolvedValueOnce(
      makeResponse({ can_create_game_events: true })
    );

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    const fab = await screen.findByRole('button', { name: /fernbedienung öffnen/i });

    await act(async () => {
      fireEvent.click(fab);
    });

    expect(screen.getByTestId('quick-event-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('supporter-modal')).not.toBeInTheDocument();
  });

  // ── Click behavior: canCreateEvents = false ─────────────────────────────────

  it('öffnet die SupporterApplicationModal wenn can_create_game_events=false', async () => {
    mockFetchGameDetails.mockResolvedValueOnce(
      makeResponse({ can_create_game_events: false })
    );

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    const fab = await screen.findByRole('button', { name: /fernbedienung öffnen/i });

    await act(async () => {
      fireEvent.click(fab);
    });

    expect(screen.getByTestId('supporter-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-event-panel')).not.toBeInTheDocument();
  });

  // ── QuickEventPanel not shown when no canCreateEvents ──────────────────────

  it('zeigt das QuickEventPanel NICHT wenn can_create_game_events=false (auch wenn Spiel läuft)', async () => {
    mockFetchGameDetails.mockResolvedValueOnce(
      makeResponse({ can_create_game_events: false })
    );

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /fernbedienung öffnen/i })).toBeInTheDocument();
    });

    // Panel should not be visible without clicking the FAB
    expect(screen.queryByTestId('quick-event-panel')).not.toBeInTheDocument();
  });
});
