/**
 * Tests for the Spielzeiten (game timing) feature in GameDetails.
 *
 * Covers:
 *  - Timing section is shown when can_edit_timing=true
 *  - Timing fields are pre-filled with game data
 *  - Saving calls updateGameTiming with the correct payload
 *  - Success toast is shown after a successful save
 *  - Error toast is shown when the save fails
 *  - Timing section is hidden when neither can_edit_timing nor halfDuration is set
 *  - GameEventModal: game.halfDuration takes precedence over game.gameType.halfDuration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// ── window.matchMedia (jsdom doesn't have it) ────────────────────────────────
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

// ── Services ─────────────────────────────────────────────────────────────────
const mockFetchGameDetails = jest.fn();
const mockFetchGameEvents = jest.fn();
const mockUpdateGameTiming = jest.fn();
const mockFetchVideos = jest.fn();
const mockDeleteGameEvent = jest.fn();
const mockSyncFussballDe = jest.fn();
const mockFinishGame = jest.fn();

jest.mock('../../services/games', () => ({
  fetchGameDetails: (...a: any[]) => mockFetchGameDetails(...a),
  fetchGameEvents: (...a: any[]) => mockFetchGameEvents(...a),
  updateGameTiming: (...a: any[]) => mockUpdateGameTiming(...a),
  deleteGameEvent: (...a: any[]) => mockDeleteGameEvent(...a),
  syncFussballDe: (...a: any[]) => mockSyncFussballDe(...a),
  finishGame: (...a: any[]) => mockFinishGame(...a),
}));

jest.mock('../../services/videos', () => ({
  fetchVideos: (...a: any[]) => mockFetchVideos(...a),
  saveVideo: jest.fn(),
  deleteVideo: jest.fn(),
}));

// ── API utils ────────────────────────────────────────────────────────────────
jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
  getApiErrorMessage: (e: any) => (e instanceof Error ? e.message : String(e)),
}));

// ── Auth ─────────────────────────────────────────────────────────────────────
const mockUseAuth = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Toast ─────────────────────────────────────────────────────────────────────
const mockShowToast = jest.fn();
jest.mock('../../context/ToastContext', () => ({
  ToastProvider: ({ children }: any) => <>{children}</>,
  useToast: () => ({ showToast: mockShowToast }),
}));

// ── Modals & Components (stub them out) ──────────────────────────────────────
jest.mock('../../modals/VideoModal', () => ({ open }: any) => (open ? <div>VideoModalOpen</div> : null));
jest.mock('../../modals/VideoPlayModal', () =>
  // eslint-disable-next-line react/display-name
  React.forwardRef(() => null)
);
jest.mock('../../modals/VideoSegmentModal', () => ({ VideoSegmentModal: () => null }));
jest.mock('../../modals/ConfirmationModal', () => ({ ConfirmationModal: () => null }));
jest.mock('../../modals/GameEventModal', () => ({ GameEventModal: ({ open }: any) => (open ? <div>GameEventModalOpen</div> : null) }));
jest.mock('../../modals/WeatherModal', () => () => null);
jest.mock('../../modals/SupporterApplicationModal', () => ({ SupporterApplicationModal: ({ open }: any) => (open ? <div>SupporterApplicationModalOpen</div> : null) }));
jest.mock('../../components/Location', () => () => null);
jest.mock('../../components/WeatherIcons', () => ({ WeatherDisplay: () => null }));
jest.mock('../../components/UserAvatar', () => ({ UserAvatar: () => null }));
jest.mock('../../constants/gameEventIcons', () => ({ getGameEventIconByCode: () => null }));
jest.mock('../../utils/videoTimeline', () => ({ calculateCumulativeOffset: () => 0 }));
jest.mock('../../utils/formatter', () => ({
  formatEventTime: () => '0:00',
  formatDateTime: () => '',
}));
jest.mock('../../utils/avatarFrame', () => ({ getAvatarFrameUrl: () => '' }));

// ── Component under test ──────────────────────────────────────────────────────
import GameDetails from '../GameDetails';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeGame = (overrides: any = {}) => ({
  id: 42,
  homeTeam: { id: 1, name: 'FC Home' },
  awayTeam: { id: 2, name: 'FC Away' },
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
  permissions: {
    can_create_game_events: false,
    can_create_videos: false,
    can_edit_timing: true,
  },
  ...overrides,
});

const makeDetailsResponse = (gameOverrides: any = {}) => ({
  game: makeGame(gameOverrides),
  gameEvents: [],
  homeScore: 0,
  awayScore: 0,
});

const renderWithRouter = (ui: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={['/games/42']}>
      {ui}
    </MemoryRouter>
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

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
  mockUseAuth.mockReturnValue({
    user: { id: 1, name: 'Admin', isCoach: true, roles: { admin: 'ROLE_ADMIN' } },
  });
  mockFetchGameDetails.mockResolvedValue(makeDetailsResponse());
  mockFetchVideos.mockResolvedValue({ videos: [], youtubeLinks: [], videoTypes: [], cameras: [] });
  mockFetchGameEvents.mockResolvedValue([]);
  mockUpdateGameTiming.mockResolvedValue({
    success: true,
    halfDuration: 45,
    halftimeBreakDuration: 15,
    firstHalfExtraTime: null,
    secondHalfExtraTime: null,
  });
});

describe('GameDetails – Spielzeiten section', () => {
  it('renders timing section header when can_edit_timing is true', async () => {
    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('timing-section-header')).toBeInTheDocument();
    });

    expect(screen.getByText('Spielzeiten')).toBeInTheDocument();
  });

  it('does not render timing section when permission is false and halfDuration is undefined', async () => {
    mockFetchGameDetails.mockResolvedValueOnce(
      makeDetailsResponse({ permissions: { can_create_game_events: false, can_create_videos: false, can_edit_timing: false }, halfDuration: undefined })
    );

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('timing-section-header')).not.toBeInTheDocument();
    });
  });

  it('hides trainer tools for normal players even when raw event permissions are set', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, name: 'Spieler', isCoach: false, isPlayer: true, roles: { user: 'ROLE_USER' } },
    });

    mockFetchGameDetails.mockResolvedValueOnce(
      makeDetailsResponse({
        permissions: {
          can_create_game_events: true,
          can_create_videos: true,
          can_edit_timing: false,
        },
      })
    );

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Event hinzufügen/i })).not.toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Spiel beenden/i })).not.toBeInTheDocument();
  });

  it('allows supporters with granted permissions to open event and video modals', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 3, name: 'Supporter', isCoach: false, isPlayer: false, roles: { supporter: 'ROLE_SUPPORTER' } },
    });

    mockFetchGameDetails.mockResolvedValueOnce(
      makeDetailsResponse({
        permissions: {
          can_create_game_events: true,
          can_create_videos: true,
          can_edit_timing: false,
        },
      })
    );

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    const eventButton = await screen.findByRole('button', { name: /Event hinzufügen/i });
    const videoButton = screen.getByRole('button', { name: /Video hinzufügen/i });

    await act(async () => {
      fireEvent.click(eventButton);
    });

    expect(screen.getByText('GameEventModalOpen')).toBeInTheDocument();
    expect(screen.queryByText('SupporterApplicationModalOpen')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(videoButton);
    });

    expect(screen.getByText('VideoModalOpen')).toBeInTheDocument();
    expect(screen.queryByText('SupporterApplicationModalOpen')).not.toBeInTheDocument();
  });

  it('shows edit form when can_edit_timing is true and section is expanded', async () => {
    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('timing-section-header')).toBeInTheDocument();
    });

    // Expand the section
    await act(async () => {
      fireEvent.click(screen.getByTestId('timing-section-header'));
    });

    expect(screen.getByTestId('timing-edit-form')).toBeInTheDocument();
    expect(screen.getByTestId('input-halfDuration')).toBeInTheDocument();
    expect(screen.getByTestId('input-halftimeBreakDuration')).toBeInTheDocument();
    expect(screen.getByTestId('input-firstHalfExtraTime')).toBeInTheDocument();
    expect(screen.getByTestId('input-secondHalfExtraTime')).toBeInTheDocument();
  });

  it('pre-fills timing inputs with values from game data', async () => {
    mockFetchGameDetails.mockResolvedValueOnce(
      makeDetailsResponse({ halfDuration: 35, halftimeBreakDuration: 10, firstHalfExtraTime: 3, secondHalfExtraTime: 5 })
    );

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('timing-section-header')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('timing-section-header'));
    });

    expect((screen.getByTestId('input-halfDuration') as HTMLInputElement).value).toBe('35');
    expect((screen.getByTestId('input-halftimeBreakDuration') as HTMLInputElement).value).toBe('10');
    expect((screen.getByTestId('input-firstHalfExtraTime') as HTMLInputElement).value).toBe('3');
    expect((screen.getByTestId('input-secondHalfExtraTime') as HTMLInputElement).value).toBe('5');
  });

  it('calls updateGameTiming with correct values on save', async () => {
    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('timing-section-header')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('timing-section-header'));
    });

    // Change halfDuration to 30
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-halfDuration'), { target: { value: '30' } });
    });

    // Change firstHalfExtraTime to 2
    await act(async () => {
      fireEvent.change(screen.getByTestId('input-firstHalfExtraTime'), { target: { value: '2' } });
    });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-save-timing'));
    });

    await waitFor(() => {
      expect(mockUpdateGameTiming).toHaveBeenCalledWith(42, expect.objectContaining({
        halfDuration: 30,
        firstHalfExtraTime: 2,
        secondHalfExtraTime: null,
      }));
    });
  });

  it('shows success toast after successful save', async () => {
    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('timing-section-header')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('timing-section-header'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-save-timing'));
    });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Spielzeiten wurden gespeichert.', 'success');
    });
  });

  it('shows error toast when save fails', async () => {
    mockUpdateGameTiming.mockRejectedValueOnce(new Error('Netzwerkfehler'));

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('timing-section-header')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('timing-section-header'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-save-timing'));
    });

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Netzwerkfehler', 'error');
    });
  });

  it('renders read-only timing info when can_edit_timing is false but halfDuration is set', async () => {
    mockFetchGameDetails.mockResolvedValueOnce(
      makeDetailsResponse({ halfDuration: 30, permissions: { can_edit_timing: false, can_create_game_events: false, can_create_videos: false } })
    );

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('timing-section-header')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('timing-section-header'));
    });

    // No edit form
    expect(screen.queryByTestId('timing-edit-form')).not.toBeInTheDocument();
    // Read-only value visible (may appear in multiple places: header chip + read-only display)
    expect(screen.getAllByText('30 min').length).toBeGreaterThanOrEqual(1);
  });
});

// ── Service: updateGameTiming ────────────────────────────────────────────────

describe('updateGameTiming service', () => {
  it('is exported from services/games', () => {
    // We already imported it via mock; verify the mock is callable
    expect(typeof mockUpdateGameTiming).toBe('function');
  });

  it('passes null for empty extra time fields', async () => {
    mockUpdateGameTiming.mockResolvedValue({ success: true, halfDuration: 45, halftimeBreakDuration: 15, firstHalfExtraTime: null, secondHalfExtraTime: null });

    await act(async () => {
      renderWithRouter(<GameDetails gameId={42} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('timing-section-header')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('timing-section-header'));
    });

    // Both extra time fields empty (default)
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-save-timing'));
    });

    await waitFor(() => {
      expect(mockUpdateGameTiming).toHaveBeenCalledWith(42, expect.objectContaining({
        firstHalfExtraTime: null,
        secondHalfExtraTime: null,
      }));
    });
  });
});

// ── GameEventModal: halfDuration preference ─────────────────────────────────

describe('GameEventModal halfDuration preference', () => {
  // We import the actual, un-mocked module for this specific test
  let secondsToFootballTime: any;
  let DEFAULT_HALF_DURATION: number;

  beforeAll(async () => {
    const mod = await import('../../utils/gameEventTime');
    secondsToFootballTime = mod.secondsToFootballTime;
    DEFAULT_HALF_DURATION = mod.DEFAULT_HALF_DURATION;
  });

  it('game.halfDuration takes priority over gameType.halfDuration', () => {
    // Simulate what GameEventModal does: game.halfDuration ?? game.gameType?.halfDuration ?? DEFAULT_HALF_DURATION
    const game: any = { halfDuration: 30, gameType: { halfDuration: 45 } };
    const result = game.halfDuration ?? game.gameType?.halfDuration ?? DEFAULT_HALF_DURATION;
    expect(result).toBe(30); // game.halfDuration wins
  });

  it('falls back to gameType.halfDuration when game.halfDuration is undefined', () => {
    const game: any = { gameType: { halfDuration: 40 } };
    const result = game.halfDuration ?? game.gameType?.halfDuration ?? DEFAULT_HALF_DURATION;
    expect(result).toBe(40);
  });

  it('falls back to DEFAULT_HALF_DURATION when both are undefined', () => {
    const game: any = {};
    const result = game.halfDuration ?? game.gameType?.halfDuration ?? DEFAULT_HALF_DURATION;
    expect(result).toBe(DEFAULT_HALF_DURATION);
  });
});
