/**
 * Unit tests for the useGameDetails hook.
 *
 * Covered branches:
 *  - Loading state on mount
 *  - Successful game data load
 *  - Error on game data fetch
 *  - Missing gameId sets error
 *  - toggleSection flips the section open state
 *  - canCreateEvents / canCreateVideos reflection of permissions
 *  - isGameRunning: no calendarEvent, past, present, future
 *  - handleBack: uses onBack prop, navigates to /games, or to tournament
 *  - handleProtectedEventAction: opens form or supporter modal
 *  - handleProtectedVideoAction: opens video dialog or supporter modal
 *  - openWeatherModal sets selectedEventId and opens modal
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGameDetails } from '../useGameDetails';

// ── matchMedia (required by any MUI import in the chain) ─────────────────────
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useParams: () => ({ id: undefined }),
  useNavigate: () => mockNavigate,
}));

const mockShowToast = jest.fn();
jest.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Tester' } }),
}));

const mockFetchGameDetails = jest.fn();
const mockFetchGameEvents = jest.fn();
const mockDeleteGameEvent = jest.fn();
const mockSyncFussballDe = jest.fn();
const mockFinishGame = jest.fn();
const mockUpdateGameTiming = jest.fn();

jest.mock('../../../services/games', () => ({
  fetchGameDetails: (...a: any[]) => mockFetchGameDetails(...a),
  fetchGameEvents: (...a: any[]) => mockFetchGameEvents(...a),
  deleteGameEvent: (...a: any[]) => mockDeleteGameEvent(...a),
  syncFussballDe: (...a: any[]) => mockSyncFussballDe(...a),
  finishGame: (...a: any[]) => mockFinishGame(...a),
  updateGameTiming: (...a: any[]) => mockUpdateGameTiming(...a),
}));

const mockFetchVideos = jest.fn();
const mockSaveVideo = jest.fn();
const mockDeleteVideo = jest.fn();

jest.mock('../../../services/videos', () => ({
  fetchVideos: (...a: any[]) => mockFetchVideos(...a),
  saveVideo: (...a: any[]) => mockSaveVideo(...a),
  deleteVideo: (...a: any[]) => mockDeleteVideo(...a),
}));

jest.mock('../../../utils/api', () => ({
  getApiErrorMessage: (e: unknown) =>
    e instanceof Error ? e.message : 'Unbekannter Fehler',
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeGameResponse = (overrides: Record<string, any> = {}) => ({
  game: {
    id: 42,
    homeTeam: { id: 1, name: 'FC Home' },
    awayTeam: { id: 2, name: 'FC Away' },
    halfDuration: 45,
    halftimeBreakDuration: 15,
    firstHalfExtraTime: null,
    secondHalfExtraTime: null,
    isFinished: false,
    permissions: {
      can_create_game_events: true,
      can_create_videos: true,
      can_finish_game: false,
    },
    ...overrides,
  },
  gameEvents: [],
  homeScore: 2,
  awayScore: 1,
});

const makeVideosResponse = () => ({
  videos: [],
  youtubeLinks: [],
  videoTypes: [],
  cameras: [],
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGameDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchGameDetails.mockResolvedValue(makeGameResponse());
    mockFetchVideos.mockResolvedValue(makeVideosResponse());
    mockFetchGameEvents.mockResolvedValue([]);
  });

  // ── Initial state ─────────────────────────────────────────────────────

  it('starts with loading=true', () => {
    const { result } = renderHook(() => useGameDetails(42));
    expect(result.current.loading).toBe(true);
  });

  it('starts with game=null', () => {
    const { result } = renderHook(() => useGameDetails(42));
    expect(result.current.game).toBeNull();
  });

  // ── Missing gameId ───────────────────────────────────────────────────

  it('sets error and stops loading when no gameId is given', async () => {
    const { result } = renderHook(() => useGameDetails(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/keine spiel-id/i);
    expect(result.current.game).toBeNull();
  });

  // ── Successful load ──────────────────────────────────────────────────

  it('sets game after successful fetch', async () => {
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.game?.id).toBe(42);
    expect(result.current.homeScore).toBe(2);
    expect(result.current.awayScore).toBe(1);
  });

  it('initialises timing state from the game response', async () => {
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ halfDuration: 30, halftimeBreakDuration: 10 })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.halfDuration).toBe(30);
    expect(result.current.halftimeBreakDuration).toBe(10);
  });

  it('converts firstHalfExtraTime number to string', async () => {
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ firstHalfExtraTime: 3, secondHalfExtraTime: 5 })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.firstHalfExtraTime).toBe('3');
    expect(result.current.secondHalfExtraTime).toBe('5');
  });

  // ── Fetch error ───────────────────────────────────────────────────────

  it('sets error message when fetchGameDetails rejects', async () => {
    mockFetchGameDetails.mockRejectedValue(new Error('Server-Fehler'));
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('Server-Fehler');
    expect(result.current.game).toBeNull();
  });

  // ── toggleSection ──────────────────────────────────────────────────────

  it('toggleSection flips the targeted section open state', async () => {
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const wasOpen = result.current.sectionsOpen.events;
    act(() => result.current.toggleSection('events'));
    expect(result.current.sectionsOpen.events).toBe(!wasOpen);
  });

  it('toggleSection does not affect other sections', async () => {
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const wasVideosOpen = result.current.sectionsOpen.videos;
    act(() => result.current.toggleSection('events'));
    expect(result.current.sectionsOpen.videos).toBe(wasVideosOpen);
  });

  // ── canCreateEvents / canCreateVideos ────────────────────────────────

  it('canCreateEvents returns true when permission is granted', async () => {
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ permissions: { can_create_game_events: true } })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canCreateEvents()).toBe(true);
  });

  it('canCreateEvents returns false when permission is denied', async () => {
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ permissions: { can_create_game_events: false } })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canCreateEvents()).toBe(false);
  });

  it('canCreateVideos returns false when permission is denied', async () => {
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ permissions: { can_create_videos: false } })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canCreateVideos()).toBe(false);
  });

  // ── isGameRunning ─────────────────────────────────────────────────────

  it('isGameRunning returns false when game has no calendarEvent', async () => {
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ calendarEvent: undefined })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isGameRunning()).toBe(false);
  });

  it('isGameRunning returns true when current time is within the event window', async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const end   = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ calendarEvent: { id: 1, startDate: start, endDate: end } })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isGameRunning()).toBe(true);
  });

  it('isGameRunning returns false when the event is in the past', async () => {
    const end   = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const start = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ calendarEvent: { id: 1, startDate: start, endDate: end } })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isGameRunning()).toBe(false);
  });

  it('isGameRunning returns false when the event is in the future', async () => {
    const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const end   = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ calendarEvent: { id: 1, startDate: start, endDate: end } })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isGameRunning()).toBe(false);
  });

  // ── handleBack ────────────────────────────────────────────────────────

  it('handleBack calls the onBack prop when provided', async () => {
    const onBack = jest.fn();
    const { result } = renderHook(() => useGameDetails(42, onBack));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleBack());
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handleBack navigates to /games when no onBack and no tournamentId', async () => {
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleBack());
    expect(mockNavigate).toHaveBeenCalledWith('/games');
  });

  it('handleBack navigates to tournament when game has tournamentId', async () => {
    mockFetchGameDetails.mockResolvedValue(makeGameResponse({ tournamentId: 7 }));
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleBack());
    expect(mockNavigate).toHaveBeenCalledWith('/tournaments/7');
  });

  // ── handleProtectedEventAction ────────────────────────────────────────

  it('opens event form when canCreateEvents is true', async () => {
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ permissions: { can_create_game_events: true } })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleProtectedEventAction());
    expect(result.current.eventFormOpen).toBe(true);
    expect(result.current.supporterApplicationOpen).toBe(false);
  });

  it('opens supporter modal when canCreateEvents is false', async () => {
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ permissions: { can_create_game_events: false } })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleProtectedEventAction());
    expect(result.current.supporterApplicationOpen).toBe(true);
    expect(result.current.eventFormOpen).toBe(false);
  });

  // ── handleProtectedVideoAction ────────────────────────────────────────

  it('opens video dialog when canCreateVideos is true', async () => {
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ permissions: { can_create_videos: true } })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleProtectedVideoAction());
    expect(result.current.videoDialogOpen).toBe(true);
    expect(result.current.supporterApplicationOpen).toBe(false);
  });

  it('opens supporter modal when canCreateVideos is false', async () => {
    mockFetchGameDetails.mockResolvedValue(
      makeGameResponse({ permissions: { can_create_videos: false } })
    );
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleProtectedVideoAction());
    expect(result.current.supporterApplicationOpen).toBe(true);
    expect(result.current.videoDialogOpen).toBe(false);
  });

  // ── openWeatherModal ──────────────────────────────────────────────────

  it('openWeatherModal sets selectedEventId and opens modal', async () => {
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.openWeatherModal(99));
    expect(result.current.selectedEventId).toBe(99);
    expect(result.current.weatherModalOpen).toBe(true);
  });

  it('openWeatherModal works with null eventId', async () => {
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.openWeatherModal(null));
    expect(result.current.selectedEventId).toBeNull();
    expect(result.current.weatherModalOpen).toBe(true);
  });

  // ── handleFinishGame ──────────────────────────────────────────────────

  it('sets isFinished=true and shows success toast after successful finishGame', async () => {
    mockFinishGame.mockResolvedValue({ advanced: null });
    // loadGameDetails is called after finishing — make it return isFinished: true
    mockFetchGameDetails
      .mockResolvedValueOnce(makeGameResponse()) // initial load
      .mockResolvedValueOnce(makeGameResponse({ isFinished: true })); // reload after finish
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.handleFinishGame(); });
    await waitFor(() => expect(result.current.isFinished).toBe(true));
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('beendet'), 'success'
    );
  });

  it('shows success toast with advancement info when game advances a tournament bracket', async () => {
    mockFinishGame.mockResolvedValue({
      advanced: { homeTeam: 'FC A', awayTeam: 'FC B', gameCreated: true },
    });
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.handleFinishGame(); });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('FC A'), 'success'
    );
  });

  it('shows error toast when finishGame rejects', async () => {
    mockFinishGame.mockRejectedValue(new Error('Netzwerkfehler'));
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.handleFinishGame(); });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('Netzwerkfehler'), 'error'
    );
  });

  // ── handleSaveTiming ──────────────────────────────────────────────────

  it('calls updateGameTiming and shows success toast', async () => {
    mockUpdateGameTiming.mockResolvedValue({});
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.handleSaveTiming(); });
    expect(mockUpdateGameTiming).toHaveBeenCalledWith(42, expect.objectContaining({
      halfDuration: 45,
      halftimeBreakDuration: 15,
    }));
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('Spielzeiten'), 'success'
    );
  });

  it('sends null for empty extra-time strings', async () => {
    mockUpdateGameTiming.mockResolvedValue({});
    const { result } = renderHook(() => useGameDetails(42));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Default firstHalfExtraTime is '' → should be sent as null
    await act(async () => { await result.current.handleSaveTiming(); });
    expect(mockUpdateGameTiming).toHaveBeenCalledWith(42, expect.objectContaining({
      firstHalfExtraTime: null,
      secondHalfExtraTime: null,
    }));
  });
});
