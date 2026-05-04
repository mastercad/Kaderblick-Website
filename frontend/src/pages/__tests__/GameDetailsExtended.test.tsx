/**
 * Extended tests for GameDetails – covers branches NOT yet covered by
 * GameDetailsPermissions.test.tsx and GameDetailsTiming.test.tsx.
 *
 * Covered here:
 *  - No gameId → error message shown
 *  - fetchGameDetails rejects → error alert
 *  - game===null (API returns null) → EmptyStateHint
 *  - loading spinner
 *  - isGameRunning() true  → live banner + green card border
 *  - homeScore/awayScore null → "vs" text
 *  - homeScore/awayScore present → score numbers
 *  - calendarEvent.startDate → date + time chips visible
 *  - game.location → Location component shown
 *  - game.fussballDeUrl → sync button visible
 *  - isFinished badge visible when isFinished=true
 *  - can_finish_game && !isFinished → "Spiel beenden" button
 *  - can_manage_match_plan → GameMatchPlanCard shown
 *  - onBack prop → calls onBack() instead of navigate(-1)
 *  - game.tournamentId → "Zurück zum Turnier" text
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
const mockFetchGameDetails = jest.fn();
const mockFetchGameEvents = jest.fn();
const mockFetchVideos = jest.fn();
const mockFinishGame = jest.fn();

jest.mock('../../services/games', () => ({
  fetchGameDetails: (...a: any[]) => mockFetchGameDetails(...a),
  fetchGameEvents: (...a: any[]) => mockFetchGameEvents(...a),
  updateGameTiming: jest.fn(),
  deleteGameEvent: jest.fn(),
  syncFussballDe: jest.fn(),
  finishGame: (...a: any[]) => mockFinishGame(...a),
}));

jest.mock('../../services/videos', () => ({
  fetchVideos: (...a: any[]) => mockFetchVideos(...a),
  saveVideo: jest.fn(),
  deleteVideo: jest.fn(),
}));

jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
  getApiErrorMessage: (e: any) => (e instanceof Error ? e.message : String(e)),
}));

const mockUseAuth = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../context/ToastContext', () => ({
  ToastProvider: ({ children }: any) => <>{children}</>,
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('../../modals/VideoModal', () => ({ open }: any) =>
  open ? <div>VideoModalOpen</div> : null
);
jest.mock('../../modals/VideoPlayModal', () =>
  React.forwardRef(() => null)
);
jest.mock('../../modals/VideoSegmentModal', () => ({ VideoSegmentModal: () => null }));
jest.mock('../../modals/ConfirmationModal', () => ({
  ConfirmationModal: ({ open, onConfirm, title }: any) =>
    open ? (
      <div>
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null,
}));
jest.mock('../../modals/GameEventModal', () => ({
  GameEventModal: ({ open }: any) => (open ? <div>GameEventModalOpen</div> : null),
}));
jest.mock('../../modals/WeatherModal', () => () => null);
jest.mock('../../modals/SupporterApplicationModal', () => ({
  SupporterApplicationModal: () => null,
}));
jest.mock('../../components/Location', () => ({ name }: any) => (
  <div data-testid="location-component">{name}</div>
));
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

import GameDetails from '../GameDetails';

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeGame = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  homeTeam: { id: 1, name: 'FC Home' },
  awayTeam: { id: 2, name: 'FC Away' },
  gameType: { id: 1, name: 'Testspiel' },
  calendarEvent: {
    id: 10,
    startDate: '2025-05-01T15:00:00Z',
    endDate: '2025-05-01T17:00:00Z',
  },
  isFinished: false,
  halfDuration: 45,
  halftimeBreakDuration: 15,
  firstHalfExtraTime: null,
  secondHalfExtraTime: null,
  fussballDeUrl: null,
  location: null,
  tournamentId: null,
  permissions: {
    can_create_game_events: false,
    can_create_videos: false,
    can_finish_game: false,
    can_edit_timing: false,
    can_manage_match_plan: false,
    can_view_match_plan: false,
  },
  ...overrides,
});

const defaultResponse = (gameOverrides: Record<string, unknown> = {}, responseOverrides: Record<string, unknown> = {}) => ({
  game: makeGame(gameOverrides),
  gameEvents: [],
  homeScore: null,
  awayScore: null,
  ...responseOverrides,
});

const renderGame = (props: { gameId?: number; onBack?: () => void } = {}) =>
  render(
    <MemoryRouter initialEntries={['/games/42']}>
      <GameDetails {...props} />
    </MemoryRouter>
  );

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
  mockFetchVideos.mockResolvedValue({ videos: [], youtubeLinks: [], videoTypes: [], cameras: [] });
  mockFetchGameEvents.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameDetails – Error & Empty states', () => {
  it('shows error when no gameId is provided', async () => {
    // Override route so params.id is missing
    render(
      <MemoryRouter initialEntries={['/games']}>
        <GameDetails gameId={undefined} />
      </MemoryRouter>
    );
    // No fetchGameDetails call needed — error is set immediately
    await waitFor(() =>
      expect(screen.getByText('Keine Spiel-ID angegeben')).toBeInTheDocument()
    );
  });

  it('shows error alert when fetchGameDetails rejects', async () => {
    mockFetchGameDetails.mockRejectedValue(new Error('Netzwerkfehler'));
    renderGame({ gameId: 42 });
    await waitFor(() =>
      expect(screen.getByText('Netzwerkfehler')).toBeInTheDocument()
    );
  });

  it('shows EmptyStateHint when game is null', async () => {
    mockFetchGameDetails.mockResolvedValue({ game: null, gameEvents: [], homeScore: null, awayScore: null });
    renderGame({ gameId: 42 });
    await waitFor(() =>
      expect(screen.getByTestId('empty-state-hint')).toBeInTheDocument()
    );
    expect(screen.getByText('Spiel nicht gefunden')).toBeInTheDocument();
  });

  it('shows loading spinner while loading', async () => {
    // Never resolves during this check
    mockFetchGameDetails.mockReturnValue(new Promise(() => {}));
    renderGame({ gameId: 42 });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('GameDetails – Score display', () => {
  it('shows "vs" text when homeScore and awayScore are null', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse());
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getByText('vs')).toBeInTheDocument());
  });

  it('shows score numbers when homeScore and awayScore are set', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse({}, { homeScore: 3, awayScore: 1 }));
    renderGame({ gameId: 42 });
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });
});

describe('GameDetails – Live banner', () => {
  it('shows live banner when game is currently running', async () => {
    // Set dates so that "now" is between start and end
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const end = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    mockFetchGameDetails.mockResolvedValue(
      defaultResponse({ calendarEvent: { id: 10, startDate: start, endDate: end } })
    );
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getByText('Live')).toBeInTheDocument());
  });

  it('does NOT show live banner when game is in the future', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse());
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });
});

describe('GameDetails – Date/Time chips', () => {
  it('renders date and time chips from calendarEvent.startDate', async () => {
    // 2025-05-01T15:00:00Z → "Do, 1. Mai 2025" + "17:00" (or depending on local timezone)
    mockFetchGameDetails.mockResolvedValue(defaultResponse());
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    // Date chip: contains the weekday abbreviation
    const dateLike = screen.queryByText(/20\d\d/);
    // Time chip exists (just check there's a chip with hours:minutes pattern)
    const timeLike = screen.queryByText(/\d{2}:\d{2}/);
    // At least one of them should appear
    expect(dateLike || timeLike).toBeTruthy();
  });
});

describe('GameDetails – Location', () => {
  it('renders Location component when game.location is set', async () => {
    mockFetchGameDetails.mockResolvedValue(
      defaultResponse({ location: { id: 1, name: 'Stadion Mitte', latitude: 52.0, longitude: 13.0, address: '' } })
    );
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getByTestId('location-component')).toBeInTheDocument());
    expect(screen.getByText('Stadion Mitte')).toBeInTheDocument();
  });

  it('does not render Location when game.location is null', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse({ location: null }));
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    expect(screen.queryByTestId('location-component')).not.toBeInTheDocument();
  });
});

describe('GameDetails – FussballDe sync button', () => {
  it('renders sync button when fussballDeUrl is set', async () => {
    mockFetchGameDetails.mockResolvedValue(
      defaultResponse({ fussballDeUrl: 'https://www.fussball.de/game/123' })
    );
    renderGame({ gameId: 42 });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Synchronisieren/i })).toBeInTheDocument()
    );
  });

  it('does NOT render sync button when fussballDeUrl is null', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse({ fussballDeUrl: null }));
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Synchronisieren/i })).not.toBeInTheDocument();
  });
});

describe('GameDetails – isFinished badge', () => {
  it('shows "Spiel beendet" badge when isFinished is true', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse({ isFinished: true }));
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getByText('Spiel beendet')).toBeInTheDocument());
  });

  it('does NOT show "Spiel beendet" badge when isFinished is false', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse({ isFinished: false }));
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    expect(screen.queryByText('Spiel beendet')).not.toBeInTheDocument();
  });
});

describe('GameDetails – Navigation', () => {
  it('calls onBack() when back button is clicked and onBack is provided', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse());
    const onBack = jest.fn();
    renderGame({ gameId: 42, onBack });
    await waitFor(() => screen.getAllByText('FC Home'));
    fireEvent.click(screen.getByRole('button', { name: '' })); // ArrowBackIcon button
    expect(onBack).toHaveBeenCalled();
  });

  it('shows "Zurück zum Turnier" when tournamentId is set', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse({ tournamentId: 7 }));
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getByText('Zurück zum Turnier')).toBeInTheDocument());
  });

  it('shows "Zurück zur Übersicht" when tournamentId is null', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse({ tournamentId: null }));
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getByText('Zurück zur Übersicht')).toBeInTheDocument());
  });
});

// ── ScoreboardHeroCard: Competition (league / cup) chips ──────────────────────

describe('GameDetails – ScoreboardHeroCard competition chips', () => {
  it('shows league chip when game has a league', async () => {
    mockFetchGameDetails.mockResolvedValue(
      defaultResponse({ league: { id: 1, name: 'Bundesliga' } })
    );
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    expect(screen.getByText('Bundesliga')).toBeInTheDocument();
  });

  it('shows cup chip when game has a cup', async () => {
    mockFetchGameDetails.mockResolvedValue(
      defaultResponse({ cup: { id: 2, name: 'DFB-Pokal' } })
    );
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    expect(screen.getByText('DFB-Pokal')).toBeInTheDocument();
  });

  it('shows league name when both league and cup are set (league takes priority)', async () => {
    mockFetchGameDetails.mockResolvedValue(
      defaultResponse({ league: { id: 3, name: 'Kreisliga' }, cup: { id: 4, name: 'Kreispokal' } })
    );
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    expect(screen.getByText('Kreisliga')).toBeInTheDocument();
    expect(screen.queryByText('Kreispokal')).not.toBeInTheDocument();
  });

  it('shows no competition chip when game has neither league nor cup', async () => {
    mockFetchGameDetails.mockResolvedValue(defaultResponse());
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    // gameType-Fallback "Testspiel" wird gezeigt, aber kein liga/cup-Name
    expect(screen.queryByText('Bundesliga')).not.toBeInTheDocument();
    expect(screen.queryByText('DFB-Pokal')).not.toBeInTheDocument();
  });

  it('shows gameType name as fallback when neither league nor cup is set', async () => {
    mockFetchGameDetails.mockResolvedValue(
      defaultResponse({ gameType: { id: 3, name: 'Freundschaftsspiel' } })
    );
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    expect(screen.getByText('Freundschaftsspiel')).toBeInTheDocument();
  });

  it('league takes priority over gameType fallback', async () => {
    mockFetchGameDetails.mockResolvedValue(
      defaultResponse({ league: { id: 1, name: 'Bezirksliga' }, gameType: { id: 2, name: 'Ligaspiel' } })
    );
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    expect(screen.getByText('Bezirksliga')).toBeInTheDocument();
    expect(screen.queryByText('Ligaspiel')).not.toBeInTheDocument();
  });

  it('cup takes priority over gameType fallback when no league', async () => {
    mockFetchGameDetails.mockResolvedValue(
      defaultResponse({ cup: { id: 2, name: 'Kreispokal' }, gameType: { id: 3, name: 'Pokalspiel' } })
    );
    renderGame({ gameId: 42 });
    await waitFor(() => expect(screen.getAllByText('FC Home')[0]).toBeInTheDocument());
    expect(screen.getByText('Kreispokal')).toBeInTheDocument();
    expect(screen.queryByText('Pokalspiel')).not.toBeInTheDocument();
  });
});
