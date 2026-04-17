import React from 'react';
import { render, screen, waitFor, act, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── Browser API shims ──────────────────────────────────────────────────────────

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

// ── API mock ───────────────────────────────────────────────────────────────────

jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
}));

import { apiJson } from '../../utils/api';
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

// ── router-dom: capture navigate calls ───────────────────────────────────────

const mockNavigate = jest.fn();
let mockUseParamsOverride: (() => Record<string, string | undefined>) | null = null;
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: (...args: unknown[]) => {
      if (mockUseParamsOverride) return mockUseParamsOverride();
      return (actual.useParams as (...a: unknown[]) => unknown)(...args);
    },
  };
});

// ── Component under test ──────────────────────────────────────────────────────

import Matchday from '../Matchday';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeMatchdayData = (overrides: Record<string, unknown> = {}) => ({
  event: {
    id: 42,
    title: 'FC Home vs FC Away',
    start: '2026-05-10T15:00:00',
    cancelled: false,
    game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
  },
  role: 'player',
  myParticipation: null,
  participationSummary: {},
  participants: [],
  attendingPlayers: [],
  rides: [],
  myRide: null,
  myTasks: [],
  allTasks: [],
  unreadNotifications: [],
  lastViewedAt: null,
  completeness: { participation: false, task: false },
  squadReadiness: null,
  ...overrides,
});

/** One upcoming game event with a `game` object (so it passes filter). */
const makeUpcomingEvent = (id: number, title: string, start: string) => ({
  id,
  title,
  start,
  end: start,
  game: { id: 100 + id },
});

const STATUSES_RESPONSE = { statuses: [] };

/**
 * Set up apiJson to respond sensibly for the default scenario:
 *   - /api/calendar/upcoming → [game42]
 *   - /api/matchday/42       → matchdayData
 *   - /api/participation/statuses → statuses
 *   - /api/matchday/42/view  → {}
 */
function setupDefaultMocks(matchdayData = makeMatchdayData(), upcomingCount = 1) {
  const upcomingEvents = Array.from({ length: upcomingCount }, (_, i) =>
    makeUpcomingEvent(42 + i, `Spiel ${i + 1}`, `2026-05-${10 + i}T15:00:00`)
  );

  mockApiJson.mockImplementation((url: string) => {
    if (url === '/api/calendar/upcoming') return Promise.resolve({ events: upcomingEvents, lookaheadDays: 7 });
    if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
    if (url.startsWith('/api/matchday/')) return Promise.resolve(matchdayData);
    if (url === '/api/participation/statuses') return Promise.resolve(STATUSES_RESPONSE);
    return Promise.resolve({});
  });
}

/** Render Matchday at /mein-spieltag/:eventId (or /mein-spieltag if no eventId). */
function renderMatchday(eventId?: string) {
  const initialPath = eventId ? `/mein-spieltag/${eventId}` : '/mein-spieltag';
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/mein-spieltag/:eventId" element={<Matchday />} />
        <Route path="/mein-spieltag" element={<Matchday />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Test Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate.mockReset();
  mockUseParamsOverride = null;
  // Suppress console errors from expected API failures
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore?.();
  (console.warn as jest.Mock).mockRestore?.();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Matchday', () => {

  // ── Loading ─────────────────────────────────────────────────────────────────

  it('shows a loading spinner while fetching data', () => {
    // Never resolves → component stays in loading state
    mockApiJson.mockReturnValue(new Promise(() => {}));
    renderMatchday('42');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  // ── No eventId – redirect to first upcoming game ───────────────────────────

  it('navigates to the first upcoming game when no eventId is in the URL', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') {
        return Promise.resolve({
          events: [makeUpcomingEvent(42, 'Spiel 1', '2026-05-10T15:00:00')],
          lookaheadDays: 7,
        });
      }
      if (url === '/api/participation/statuses') return Promise.resolve(STATUSES_RESPONSE);
      return Promise.resolve({});
    });

    renderMatchday(); // no eventId

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/mein-spieltag/42', { replace: true })
    );
  });

  it('shows empty state when upcoming returns no games', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [], lookaheadDays: 14 });
      return Promise.resolve(STATUSES_RESPONSE);
    });

    renderMatchday(); // no eventId

    await waitFor(() =>
      expect(screen.getByText(/keine spiele in sicht/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/14 tagen/i)).toBeInTheDocument();
  });

  it('shows error when upcoming endpoint fails and no eventId is present', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.reject(new Error('Network error'));
      return Promise.resolve(STATUSES_RESPONSE);
    });

    renderMatchday(); // no eventId

    await waitFor(() =>
      expect(screen.getByText(/spieltag konnte nicht geladen werden/i)).toBeInTheDocument()
    );
  });

  // ── With eventId – main content ────────────────────────────────────────────

  it('renders the event title after successful load', async () => {
    setupDefaultMocks();

    renderMatchday('42');

    await waitFor(() =>
      expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument()
    );
  });

  it('shows an error message when matchday fetch fails', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url.startsWith('/api/matchday/') && !url.endsWith('/view')) return Promise.reject(new Error('500'));
      if (url === '/api/participation/statuses') return Promise.resolve(STATUSES_RESPONSE);
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() =>
      expect(screen.getByText(/spieltag konnte nicht geladen werden/i)).toBeInTheDocument()
    );
  });

  // ── CompletenessBar ────────────────────────────────────────────────────────

  it('CompletenessBar shows exactly "Teilnahme" and "Aufgabe" — no "Fahrgemeinschaft"', async () => {
    setupDefaultMocks(makeMatchdayData({ completeness: { participation: true, task: true } }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());

    // 'Teilnahme' appears in both CompletenessBar and section header — verify at least one instance
    expect(screen.getAllByText('Teilnahme').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Aufgabe').length).toBeGreaterThanOrEqual(1);
    // 'Fahrgemeinschaft' must NOT appear as a CompletenessBar step (though the section header still exists)
    const bar = screen.getByTestId('completeness-bar');
    expect(within(bar).queryByText(/fahrgemeinschaft/i)).not.toBeInTheDocument();
  });

  it('CompletenessBar shows "2/2" when both steps are done', async () => {
    setupDefaultMocks(makeMatchdayData({ completeness: { participation: true, task: true } }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/2\/2/)).toBeInTheDocument());
  });

  it('CompletenessBar shows "0/2" when neither step is done', async () => {
    setupDefaultMocks(makeMatchdayData({ completeness: { participation: false, task: false } }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/0\/2/)).toBeInTheDocument());
  });

  it('CompletenessBar shows "1/2" when only participation is done', async () => {
    setupDefaultMocks(makeMatchdayData({ completeness: { participation: true, task: false } }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/1\/2/)).toBeInTheDocument());
  });

  // ── Multi-game Tabs ────────────────────────────────────────────────────────

  it('does not render Tabs when only one upcoming game', async () => {
    setupDefaultMocks(makeMatchdayData(), 1); // single game → no tabs

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());

    // MUI Tabs renders with role="tablist"; should not be present
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('renders Tabs when multiple upcoming games are available', async () => {
    const matchdayData = makeMatchdayData();
    setupDefaultMocks(matchdayData, 3); // 3 upcoming games → show tabs

    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());
  });

  it('renders one tab per upcoming game', async () => {
    setupDefaultMocks(makeMatchdayData(), 3);

    renderMatchday('42');

    await waitFor(() => {
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });
  });

  it('tab labels contain game titles', async () => {
    setupDefaultMocks(makeMatchdayData(), 2);

    renderMatchday('42');

    await waitFor(() => {
      expect(screen.getByText('Spiel 1')).toBeInTheDocument();
      expect(screen.getByText('Spiel 2')).toBeInTheDocument();
    });
  });

  // ── Swipe gestures ─────────────────────────────────────────────────────────

  it('swipe left navigates to the next game', async () => {
    setupDefaultMocks(makeMatchdayData(), 3);

    const { container } = renderMatchday('42'); // eventId 42 = index 0

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    const wrapper = container.firstChild as HTMLElement;

    // Simulate a leftward swipe: start at x=300, end at x=220 (dx=80 > 60)
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 220, clientY: 105 }] });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/mein-spieltag/43')
    );
  });

  it('swipe right navigates to the previous game', async () => {
    setupDefaultMocks(makeMatchdayData(), 3);

    const { container } = renderMatchday('43'); // eventId 43 = index 1

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    const wrapper = container.firstChild as HTMLElement;

    // Simulate a rightward swipe: start at x=220, end at x=300 (dx=-80)
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 220, clientY: 100 }] });
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 300, clientY: 105 }] });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/mein-spieltag/42')
    );
  });

  it('does not navigate when swipe distance is below 60px threshold', async () => {
    setupDefaultMocks(makeMatchdayData(), 3);

    const { container } = renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    const wrapper = container.firstChild as HTMLElement;

    // Only 50px movement → below threshold
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 250, clientY: 105 }] });

    // navigate should only have been called during initial redirect (if any)
    const navigateCalls = mockNavigate.mock.calls.filter(
      (args: string[]) => args[0] && typeof args[0] === 'string' && args[0].startsWith('/mein-spieltag/')
    );
    // No tab-switch navigate expected
    expect(navigateCalls.length).toBe(0);
  });

  it('does not navigate on predominantly vertical swipe', async () => {
    setupDefaultMocks(makeMatchdayData(), 3);

    const { container } = renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    const wrapper = container.firstChild as HTMLElement;

    // dx=40, dy=100 → more vertical than horizontal
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 260, clientY: 200 }] });

    const navigateCalls = mockNavigate.mock.calls.filter(
      (args: string[]) => args[0] && typeof args[0] === 'string' && args[0].startsWith('/mein-spieltag/')
    );
    expect(navigateCalls.length).toBe(0);
  });

  // ── "Verwalten" deep link ──────────────────────────────────────────────────

  it('"Verwalten" link points to /calendar?eventId=42&openRides=1', async () => {
    setupDefaultMocks();

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());

    const link = screen.getByRole('link', { name: /verwalten/i });
    expect(link).toHaveAttribute('href', '/calendar?eventId=42&openRides=1');
  });

  // ── Meeting point section ──────────────────────────────────────────────────

  it('does not show meeting point Paper when neither meetingPoint nor meetingTime are set', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: false,
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
        // no meetingPoint, no meetingTime
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());

    expect(screen.queryByText('Treffpunkt')).not.toBeInTheDocument();
  });

  it('shows "Treffpunkt" header and plain text meetingPoint when no meetingLocation', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: false,
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
        meetingPoint: 'Parkplatz Ost',
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Treffpunkt')).toBeInTheDocument());
    expect(screen.getByText('Parkplatz Ost')).toBeInTheDocument();
  });

  it('shows meeting section when only meetingTime is set (no meetingPoint)', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: false,
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
        meetingTime: '2026-05-10T14:30:00',
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Treffpunkt')).toBeInTheDocument());
    expect(screen.getByText(/Treffzeit:/)).toBeInTheDocument();
    // meetingPoint row should not be shown
    expect(screen.queryByText('Parkplatz Ost')).not.toBeInTheDocument();
  });

  it('shows Treffzeit row when meetingTime and meetingPoint are both set', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: false,
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
        meetingPoint: 'Haupteingang',
        meetingTime: '2026-05-10T14:30:00',
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Treffpunkt')).toBeInTheDocument());
    expect(screen.getByText('Haupteingang')).toBeInTheDocument();
    expect(screen.getByText(/Treffzeit:/)).toBeInTheDocument();
  });

  it('renders Location component name when meetingPoint + meetingLocation are set', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: false,
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
        meetingPoint: 'Irgendwo',
        meetingLocation: { id: 5, name: 'Freizeitzentrum West', latitude: 48.1, longitude: 11.6 },
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Treffpunkt')).toBeInTheDocument());
    // Location renders its name as link text
    expect(screen.getByText('Freizeitzentrum West')).toBeInTheDocument();
  });

  it('does not render plain meetingPoint text when meetingLocation is provided', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: false,
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
        meetingPoint: 'NichtAnzeigen',
        meetingLocation: { id: 5, name: 'Sportzentrum', latitude: 48.1, longitude: 11.6 },
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Treffpunkt')).toBeInTheDocument());
    // Plain text is NOT rendered when meetingLocation is present
    expect(screen.queryByText('NichtAnzeigen')).not.toBeInTheDocument();
  });

  // ── Back navigation button ────────────────────────────────────────────────

  it('back navigation IconButton calls navigate(-1)', async () => {
    setupDefaultMocks();
    renderMatchday('42');
    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());

    // There's an IconButton containing ArrowBackIcon (back nav)
    const backBtn = screen.getAllByRole('button').find(b => b.closest('[aria-label]') === null && b.querySelector('svg') !== null);
    // Use a more targeted selector: first button before "Mein Spieltag"
    const allButtons = screen.getAllByRole('button');
    // The back IconButton is the very first button rendered
    fireEvent.click(allButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  // ── Tabs onChange ─────────────────────────────────────────────────────────

  it('clicking a tab navigates to the corresponding game', async () => {
    setupDefaultMocks(makeMatchdayData(), 3);
    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[2]); // click third tab → navigate to game index 2 → id 44

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/mein-spieltag/44')
    );
  });

  // ── Error state back button ────────────────────────────────────────────────

  it('error state back button calls navigate(-1)', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url.startsWith('/api/matchday/') && !url.endsWith('/view')) return Promise.reject(new Error('500'));
      if (url === '/api/participation/statuses') return Promise.resolve(STATUSES_RESPONSE);
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() =>
      expect(screen.getByText(/spieltag konnte nicht geladen werden/i)).toBeInTheDocument()
    );

    const backBtn = screen.getByRole('button', { name: /zurück/i });
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  // ── participation statuses catch branch ───────────────────────────────────

  it('still loads matchday data when participation/statuses API fails', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url === '/api/participation/statuses') return Promise.reject(new Error('statuses fail'));
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData());
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() =>
      expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument()
    );
  });

  // ── handleParticipation ────────────────────────────────────────────────────

  it('handleParticipation calls API and refreshes data', async () => {
    const statuses = [{ id: 1, name: 'Zusagen', color: '#28a745', sort_order: 1 }];
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url === '/api/participation/statuses') return Promise.resolve({ statuses });
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/') && url.includes('/respond')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData());
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zusagen' })).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Zusagen' }));
    });

    // After click, apiJson should have been called with the respond endpoint
    expect(mockApiJson).toHaveBeenCalledWith(
      expect.stringContaining('/respond'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('handleParticipation silently handles API error', async () => {
    const statuses = [{ id: 1, name: 'Zusagen', color: '#28a745', sort_order: 1 }];
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url === '/api/participation/statuses') return Promise.resolve({ statuses });
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/') && url.includes('/respond')) return Promise.reject(new Error('network'));
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData());
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zusagen' })).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Zusagen' }));
    });

    // No error shown — page still renders title
    expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument();
  });

  // ── Event header details ──────────────────────────────────────────────────

  it('shows event location name, address, and city', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: false,
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
        location: { id: 1, name: 'Stadion Nord', address: 'Musterstraße 1', city: 'Musterstadt' },
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());
    expect(screen.getByText(/Stadion Nord/)).toBeInTheDocument();
    expect(screen.getByText(/Musterstraße 1/)).toBeInTheDocument();
    expect(screen.getByText(/Musterstadt/)).toBeInTheDocument();
  });

  it('shows event description', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: false,
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
        description: 'Wichtiges Derby',
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Wichtiges Derby')).toBeInTheDocument());
  });

  it('shows cancelled banner with reason and cancelledBy', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: true,
        cancelReason: 'Schlechtes Wetter',
        cancelledBy: 'Trainer Müller',
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/Abgesagt/i)).toBeInTheDocument());
    expect(screen.getByText(/Schlechtes Wetter/)).toBeInTheDocument();
    expect(screen.getByText(/Trainer Müller/)).toBeInTheDocument();
  });

  it('shows cancelled banner without reason or cancelledBy', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: true,
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/Abgesagt/i)).toBeInTheDocument());
  });

  // ── Notifications ─────────────────────────────────────────────────────────

  it('shows single notification with message', async () => {
    setupDefaultMocks(makeMatchdayData({
      unreadNotifications: [{ id: 1, type: 'info', title: 'Neues Update', message: 'Details hier', createdAt: '2026-05-10T10:00:00' }],
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Neues Update')).toBeInTheDocument());
    expect(screen.getByText(/Details hier/)).toBeInTheDocument();
    // single → no 'en' suffix
    expect(screen.getByText(/1 neue Benachrichtigung(?!en)/)).toBeInTheDocument();
  });

  it('shows plural "en" suffix when multiple notifications', async () => {
    setupDefaultMocks(makeMatchdayData({
      unreadNotifications: [
        { id: 1, type: 'info', title: 'Benachrichtigung A', message: null, createdAt: '2026-05-10T10:00:00' },
        { id: 2, type: 'info', title: 'Benachrichtigung B', message: 'Extra Info', createdAt: '2026-05-10T11:00:00' },
      ],
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/2 neue Benachrichtigungen/)).toBeInTheDocument());
    expect(screen.getByText('Benachrichtigung A')).toBeInTheDocument();
    // Second notification has message
    expect(screen.getByText(/Extra Info/)).toBeInTheDocument();
  });

  it('shows notification without message (no dash suffix)', async () => {
    setupDefaultMocks(makeMatchdayData({
      unreadNotifications: [{ id: 1, type: 'info', title: 'Nur Titel', message: null, createdAt: '2026-05-10T10:00:00' }],
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Nur Titel')).toBeInTheDocument());
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });

  // ── Participation sections (coach/admin vs player) ─────────────────────────

  it('shows participant list for coach/admin with participants', async () => {
    setupDefaultMocks(makeMatchdayData({
      role: 'coach',
      participants: [
        { userId: 1, name: 'Max Mustermann', status: 'Zusagen', statusId: 1, statusCode: 'attending', statusColor: '#28a745' },
        { userId: 2, name: 'Erika Muster', status: 'Absagen', statusId: 2, statusCode: 'not_attending', statusColor: null },
      ],
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Max Mustermann')).toBeInTheDocument());
    expect(screen.getByText('Erika Muster')).toBeInTheDocument();
    expect(screen.getByText(/Alle Rückmeldungen/)).toBeInTheDocument();
  });

  it('shows attendingPlayers list for player role', async () => {
    setupDefaultMocks(makeMatchdayData({
      role: 'player',
      attendingPlayers: ['Hans Klein', 'Peter Groß'],
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/Wer ist dabei/)).toBeInTheDocument());
    expect(screen.getByText('Hans Klein')).toBeInTheDocument();
    expect(screen.getByText('Peter Groß')).toBeInTheDocument();
  });

  it('shows "Noch keine Rückmeldungen" when participationSummary is empty', async () => {
    setupDefaultMocks(makeMatchdayData({ participationSummary: {} }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/Noch keine Rückmeldungen/)).toBeInTheDocument());
  });

  it('shows participation summary chips', async () => {
    setupDefaultMocks(makeMatchdayData({ participationSummary: { Zusagen: 5, Absagen: 2 } }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Zusagen: 5')).toBeInTheDocument());
    expect(screen.getByText('Absagen: 2')).toBeInTheDocument();
  });

  it('shows active participation chip when myParticipation is set', async () => {
    const statuses = [
      { id: 1, name: 'Zusagen', color: '#28a745', sort_order: 1 },
      { id: 2, name: 'Absagen', color: '#dc3545', sort_order: 2 },
    ];
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url === '/api/participation/statuses') return Promise.resolve({ statuses });
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData({ myParticipation: { id: 99, status: 'Zusagen', statusId: 1 } }));
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zusagen' })).toBeInTheDocument());
    // Button variant 'contained' for active status
    const zusagenBtn = screen.getByRole('button', { name: 'Zusagen' });
    expect(zusagenBtn).toBeInTheDocument();
  });

  // ── Rides section ─────────────────────────────────────────────────────────

  it('shows "Noch keine Fahrgemeinschaften" when rides is empty', async () => {
    setupDefaultMocks(makeMatchdayData({ rides: [] }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/Noch keine Fahrgemeinschaften/)).toBeInTheDocument());
  });

  it('renders rides with passengers and myRide driver chip', async () => {
    setupDefaultMocks(makeMatchdayData({
      rides: [
        {
          id: 10,
          driverId: 1,
          driver: 'Karl Fahrer',
          seats: 4,
          availableSeats: 2,
          note: 'Treffpunkt Parkplatz',
          isMyRide: true,
          passengers: [{ id: 2, name: 'Anna Mitfahrer' }],
        },
      ],
      myRide: { type: 'driver', rideId: 10 },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Karl Fahrer')).toBeInTheDocument());
    expect(screen.getByText('Treffpunkt Parkplatz')).toBeInTheDocument();
    expect(screen.getByText(/Anna Mitfahrer/)).toBeInTheDocument();
    expect(screen.getByText(/2 frei/)).toBeInTheDocument();
    expect(screen.getByText('Fahrer')).toBeInTheDocument(); // myRide chip
  });

  it('renders passenger chip when myRide type is passenger', async () => {
    setupDefaultMocks(makeMatchdayData({
      rides: [
        {
          id: 11,
          driverId: 3,
          driver: 'Bernd Fahrer',
          seats: 4,
          availableSeats: 0,
          note: null,
          isMyRide: true,
          passengers: [],
        },
      ],
      myRide: { type: 'passenger', rideId: 11 },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Bernd Fahrer')).toBeInTheDocument());
    expect(screen.getByText('Mitfahrer')).toBeInTheDocument();
    expect(screen.getByText(/0 frei/)).toBeInTheDocument();
  });

  // ── Tasks ─────────────────────────────────────────────────────────────────

  it('shows "Keine Aufgaben" when coach has no tasks', async () => {
    setupDefaultMocks(makeMatchdayData({ role: 'coach', myTasks: [], allTasks: [] }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Aufgaben am Spieltag')).toBeInTheDocument());
    expect(screen.getByText(/Keine Aufgaben für dich/)).toBeInTheDocument();
  });

  it('renders myTasks with done and not-done states', async () => {
    setupDefaultMocks(makeMatchdayData({
      role: 'player',
      myTasks: [
        { assignmentId: 1, taskId: 1, title: 'Spielerbericht', status: 'offen', isDone: false },
        { assignmentId: 2, taskId: 2, title: 'Trikots packen', status: 'erledigt', isDone: true },
      ],
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Spielerbericht')).toBeInTheDocument());
    expect(screen.getByText('Trikots packen')).toBeInTheDocument();
    // Not-done task shows status chip
    expect(screen.getByText('offen')).toBeInTheDocument();
  });

  it('coach sees "Aufgaben am Spieltag" header', async () => {
    setupDefaultMocks(makeMatchdayData({ role: 'coach', myTasks: [], allTasks: [] }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Aufgaben am Spieltag')).toBeInTheDocument());
  });

  it('coach sees all tasks section when allTasks is non-empty', async () => {
    setupDefaultMocks(makeMatchdayData({
      role: 'coach',
      myTasks: [],
      allTasks: [
        { assignmentId: 10, taskId: 1, title: 'Bälle aufpumpen', status: 'offen', isDone: false, assignedTo: 'Max Muster' },
        { assignmentId: 11, taskId: 2, title: 'Tore aufstellen', status: 'erledigt', isDone: true, assignedTo: 'Erika Muster' },
      ],
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/Alle \(2\)/)).toBeInTheDocument());
    expect(screen.getByText('Bälle aufpumpen')).toBeInTheDocument();
    expect(screen.getByText('Tore aufstellen')).toBeInTheDocument();
    expect(screen.getByText(/Max Muster/)).toBeInTheDocument();
  });

  // ── Squad readiness ────────────────────────────────────────────────────────

  it('does not render Kaderbesetzung when squadReadiness is null', async () => {
    setupDefaultMocks(makeMatchdayData({ squadReadiness: null }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());
    expect(screen.queryByText('Kaderbesetzung')).not.toBeInTheDocument();
  });

  it('renders SquadReadinessCard with formation view (hasMatchPlan)', async () => {
    const team = {
      teamId: 1,
      teamName: 'A-Jugend',
      attending: 9,
      total: 11,
      trafficLight: 'yellow' as const,
      completionPercent: 82,
      hasMatchPlan: true,
      startingXI: [
        {
          slot: 'TW',
          playerName: 'Klaus Torhüter',
          playerId: 1,
          userId: 1,
          statusId: 1,
          statusName: 'Zusagen',
          statusCode: 'attending',
          statusColor: null,
          isConfirmed: true,
          suggestions: [],
        },
        {
          slot: 'LA',
          playerName: null, // open slot
          playerId: null,
          userId: null,
          statusId: null,
          statusName: null,
          statusCode: 'none',
          statusColor: null,
          isConfirmed: false,
          suggestions: [
            { playerId: 5, name: 'Ersatz Spieler', positionShort: 'LA', isMainPosition: true },
            { playerId: 6, name: 'Alternativ', positionShort: 'LV', isMainPosition: false },
          ],
        },
        {
          slot: 'RA',
          playerName: 'Unconfirmed Player',
          playerId: 7,
          userId: 7,
          statusId: 2,
          statusName: 'Vielleicht',
          statusCode: 'maybe',
          statusColor: null,
          isConfirmed: false,
          suggestions: [{ playerId: 8, name: 'Backup', positionShort: 'RA', isMainPosition: false }],
        },
      ],
      bench: [
        {
          slot: 'Bank1',
          playerName: 'Bankdrücker',
          playerId: 10,
          userId: 10,
          statusId: 1,
          statusName: 'Zusagen',
          statusCode: 'attending',
          statusColor: '#28a745',
          isConfirmed: true,
          suggestions: [],
        },
        {
          slot: 'Bank2',
          playerName: 'NochEiner',
          playerId: 11,
          userId: 11,
          statusId: null,
          statusName: null,
          statusCode: 'none',
          statusColor: null,
          isConfirmed: false,
          suggestions: [],
        },
      ],
      unplanned: [
        {
          playerId: 20,
          name: 'Unplanned Player',
          positionShort: 'ST',
          userId: 20,
          statusId: 1,
          statusName: 'Zusagen',
          statusCode: 'attending',
          statusColor: null,
          alternativePositions: ['LA', 'RA'],
        },
        {
          playerId: 21,
          name: 'No Alt',
          positionShort: 'IV',
          userId: 21,
          statusId: null,
          statusName: null,
          statusCode: 'none',
          statusColor: null,
          alternativePositions: [],
        },
      ],
      playersByPosition: null,
    };

    setupDefaultMocks(makeMatchdayData({ squadReadiness: [team] }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Kaderbesetzung')).toBeInTheDocument());
    expect(screen.getByText('A-Jugend')).toBeInTheDocument();
    expect(screen.getByText('Klaus Torhüter')).toBeInTheDocument();
    expect(screen.getByText('Nicht besetzt')).toBeInTheDocument();
    expect(screen.getByText('Ersatz Spieler')).toBeInTheDocument();
    expect(screen.getByText('Alternativ')).toBeInTheDocument();
    expect(screen.getByText('Unplanned Player')).toBeInTheDocument();
    expect(screen.getByText('Bankdrücker')).toBeInTheDocument();
  });

  it('renders SquadReadinessCard position-grouped fallback (no matchPlan)', async () => {
    const team = {
      teamId: 2,
      teamName: 'B-Jugend',
      attending: 8,
      total: 10,
      trafficLight: 'green' as const,
      completionPercent: 80,
      hasMatchPlan: false,
      startingXI: null,
      bench: null,
      unplanned: null,
      playersByPosition: {
        Stürmer: [
          {
            playerId: 1,
            name: 'Mit Status',
            positionShort: 'ST',
            userId: 1,
            statusId: 1,
            statusName: 'Zusagen',
            statusCode: 'attending',
            statusColor: null,
            alternativePositions: ['LA'],
          },
          {
            playerId: 2,
            name: 'Ohne Status',
            positionShort: 'ST',
            userId: 2,
            statusId: null,
            statusName: null,
            statusCode: 'none',
            statusColor: null,
            alternativePositions: undefined,
          },
        ],
      },
    };

    setupDefaultMocks(makeMatchdayData({ squadReadiness: [team] }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('B-Jugend')).toBeInTheDocument());
    expect(screen.getByText('Mit Status')).toBeInTheDocument();
    expect(screen.getByText('Ohne Status')).toBeInTheDocument();
    expect(screen.getByText('Stürmer')).toBeInTheDocument();
  });

  it('SlotStatusIcon renders attending (green check) in SquadReadinessCard startingXI', async () => {
    const team = {
      teamId: 3,
      teamName: 'Testteam',
      attending: 1,
      total: 1,
      trafficLight: 'green' as const,
      completionPercent: 100,
      hasMatchPlan: true,
      startingXI: [
        {
          slot: 'TW',
          playerName: 'Confirmed',
          playerId: 1,
          userId: 1,
          statusId: 1,
          statusName: 'Zugesagt',
          statusCode: 'attending',
          statusColor: null,
          isConfirmed: true,
          suggestions: [],
        },
      ],
      bench: null,
      unplanned: null,
      playersByPosition: null,
    };

    setupDefaultMocks(makeMatchdayData({ squadReadiness: [team] }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Confirmed')).toBeInTheDocument());
    // attending → CheckCircleIcon rendered (accessible by presence in DOM)
    expect(screen.getByText('Testteam')).toBeInTheDocument();
  });

  it('SlotStatusIcon renders colored dot for non-attending non-none status', async () => {
    const team = {
      teamId: 4,
      teamName: 'Dotteam',
      attending: 0,
      total: 1,
      trafficLight: 'red' as const,
      completionPercent: 0,
      hasMatchPlan: true,
      startingXI: [
        {
          slot: 'TW',
          playerName: 'Maybe Player',
          playerId: 1,
          userId: 1,
          statusId: 2,
          statusName: 'Vielleicht',
          statusCode: 'maybe',
          statusColor: null,
          isConfirmed: false,
          suggestions: [],
        },
      ],
      bench: null,
      unplanned: null,
      playersByPosition: null,
    };

    setupDefaultMocks(makeMatchdayData({ squadReadiness: [team] }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Maybe Player')).toBeInTheDocument());
    expect(screen.getByText('Dotteam')).toBeInTheDocument();
  });

  it('SlotStatusIcon renders RadioButtonUnchecked for empty statusCode', async () => {
    const team = {
      teamId: 99,
      teamName: 'Emptyteam',
      attending: 0,
      total: 1,
      trafficLight: 'red' as const,
      completionPercent: 0,
      hasMatchPlan: true,
      startingXI: [
        {
          slot: 'TW',
          playerName: 'Empty Code Player',
          playerId: 1,
          userId: 1,
          statusId: null,
          statusName: null,
          statusCode: '', // empty string → RadioButtonUnchecked branch
          statusColor: null,
          isConfirmed: false,
          suggestions: [],
        },
      ],
      bench: null,
      unplanned: null,
      playersByPosition: null,
    };

    setupDefaultMocks(makeMatchdayData({ squadReadiness: [team] }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Empty Code Player')).toBeInTheDocument());
  });

  it('SlotStatusIcon renders colored dot without statusName (uses statusCode as title)', async () => {
    const team = {
      teamId: 5,
      teamName: 'Nullteam',
      attending: 0,
      total: 1,
      trafficLight: 'red' as const,
      completionPercent: 0,
      hasMatchPlan: true,
      startingXI: [
        {
          slot: 'TW',
          playerName: 'Unknown Status Player',
          playerId: 1,
          userId: 1,
          statusId: 99,
          statusName: null,
          statusCode: 'custom_status',
          statusColor: null,
          isConfirmed: false,
          suggestions: [],
        },
      ],
      bench: null,
      unplanned: null,
      playersByPosition: null,
    };

    setupDefaultMocks(makeMatchdayData({ squadReadiness: [team] }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Unknown Status Player')).toBeInTheDocument());
  });

  // ── Event header: location address/city optional parts ────────────────────

  it('shows location name only (no address/city)', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: false,
        game: { homeTeam: { id: 1, name: 'FC Home' }, awayTeam: { id: 2, name: 'FC Away' } },
        location: { id: 1, name: 'Sportplatz' },
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText(/Sportplatz/)).toBeInTheDocument());
  });

  it('does not show game teams row when event has no game', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'Sonstiger Termin',
        start: '2026-05-10T15:00:00',
        cancelled: false,
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Sonstiger Termin')).toBeInTheDocument());
    expect(screen.queryByText(/vs\./)).not.toBeInTheDocument();
  });

  // ── Null-coalescing branches in SquadReadinessCard ─────────────────────────

  it('SquadReadinessCard renders slot with null slot label (uses "—")', async () => {
    const team = {
      teamId: 10,
      teamName: 'Nullslotteam',
      attending: 1,
      total: 1,
      trafficLight: 'green' as const,
      completionPercent: 100,
      hasMatchPlan: true,
      startingXI: [
        {
          slot: null, // → renders '—'
          playerName: 'Spieler',
          playerId: 1,
          userId: 1,
          statusId: 1,
          statusName: 'Zusagen',
          statusCode: 'attending',
          statusColor: null,
          isConfirmed: true,
          suggestions: [],
        },
      ],
      bench: null,
      unplanned: null,
      playersByPosition: null,
    };

    setupDefaultMocks(makeMatchdayData({ squadReadiness: [team] }));
    renderMatchday('42');
    await waitFor(() => expect(screen.getByText('Spieler')).toBeInTheDocument());
    // slot=null → renders '—'
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('SquadReadinessCard bench slot with null playerName renders "—"', async () => {
    const team = {
      teamId: 11,
      teamName: 'Benchnullteam',
      attending: 0,
      total: 1,
      trafficLight: 'yellow' as const,
      completionPercent: 0,
      hasMatchPlan: true,
      startingXI: [
        {
          slot: 'TW',
          playerName: 'Goalie',
          playerId: 1,
          userId: 1,
          statusId: 1,
          statusName: 'Zusagen',
          statusCode: 'attending',
          statusColor: null,
          isConfirmed: true,
          suggestions: [],
        },
      ],
      bench: [
        {
          slot: 'B1',
          playerName: null, // → renders '—'
          playerId: null,
          userId: null,
          statusId: null,
          statusName: null,
          statusCode: 'none',
          statusColor: null,
          isConfirmed: false,
          suggestions: [],
        },
      ],
      unplanned: null,
      playersByPosition: null,
    };

    setupDefaultMocks(makeMatchdayData({ squadReadiness: [team] }));
    renderMatchday('42');
    await waitFor(() => expect(screen.getByText('Benchnullteam')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('SquadReadinessCard unplanned player with hasStatus and null statusName (uses statusCode)', async () => {
    const team = {
      teamId: 12,
      teamName: 'Unplannednullteam',
      attending: 1,
      total: 2,
      trafficLight: 'yellow' as const,
      completionPercent: 50,
      hasMatchPlan: true,
      startingXI: [
        {
          slot: 'TW',
          playerName: 'Starter',
          playerId: 1,
          userId: 1,
          statusId: 1,
          statusName: 'Zusagen',
          statusCode: 'attending',
          statusColor: null,
          isConfirmed: true,
          suggestions: [],
        },
      ],
      bench: null,
      unplanned: [
        {
          playerId: 30,
          name: 'Spieler ohne StatusName',
          positionShort: 'ST',
          userId: 30,
          statusId: 1,
          statusName: null, // null → uses statusCode as tooltip
          statusCode: 'attending', // non-none, non-empty → hasStatus=true; but attending uses STATUS_CODE_COLOR
          statusColor: null,
          alternativePositions: [],
        },
      ],
      playersByPosition: null,
    };

    setupDefaultMocks(makeMatchdayData({ squadReadiness: [team] }));
    renderMatchday('42');
    await waitFor(() => expect(screen.getByText('Spieler ohne StatusName')).toBeInTheDocument());
  });

  it('SquadReadinessCard position-grouped player with null statusName and hasStatus (uses statusCode)', async () => {
    const team = {
      teamId: 13,
      teamName: 'PosGroupNullName',
      attending: 1,
      total: 1,
      trafficLight: 'green' as const,
      completionPercent: 100,
      hasMatchPlan: false,
      startingXI: null,
      bench: null,
      unplanned: null,
      playersByPosition: {
        Mittelfeld: [
          {
            playerId: 40,
            name: 'Mittelfeldspieler',
            positionShort: 'ZM',
            userId: 40,
            statusId: 2,
            statusName: null, // null → uses statusCode
            statusCode: 'maybe', // hasStatus = true
            statusColor: null,
            alternativePositions: ['LA'],
          },
        ],
      },
    };

    setupDefaultMocks(makeMatchdayData({ squadReadiness: [team] }));
    renderMatchday('42');
    await waitFor(() => expect(screen.getByText('Mittelfeldspieler')).toBeInTheDocument());
  });

  // ── lookaheadDays ?? 7 branch ──────────────────────────────────────────────

  it('uses default 7-day lookahead when response has no lookaheadDays', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [] }); // no lookaheadDays
      return Promise.resolve(STATUSES_RESPONSE);
    });

    renderMatchday(); // no eventId → no games path

    await waitFor(() => expect(screen.getByText(/7 Tagen/)).toBeInTheDocument());
  });

  it('uses default [] when response has no events array', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({}); // no events key
      return Promise.resolve(STATUSES_RESPONSE);
    });

    renderMatchday(); // no eventId

    await waitFor(() => expect(screen.getByText(/Keine Spiele in Sicht/i)).toBeInTheDocument());
  });

  // ── currentTabIndex < 0 (eventId not found in upcomingGames) ─────────────

  it('activeTab is false when eventId is not in upcomingGames', async () => {
    // eventId 99 not in upcoming games [42, 43]
    setupDefaultMocks(makeMatchdayData(), 2);
    renderMatchday('99'); // not in upcoming list

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());
    // Tabs shown (2+ games) but no active tab matching event 99
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('swipe on single-game view (length<=1) does nothing', async () => {
    setupDefaultMocks(makeMatchdayData(), 1);
    const { container } = renderMatchday('42');

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());

    const wrapper = container.firstChild as HTMLElement;
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 220, clientY: 100 }] });

    // No navigation from swipe
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/mein-spieltag/'));
  });

  it('swipe on eventId not in upcomingGames (currentTabIndex<0) does nothing', async () => {
    setupDefaultMocks(makeMatchdayData(), 2);
    const { container } = renderMatchday('99'); // id 99 not in upcoming [42, 43]

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());

    const wrapper = container.firstChild as HTMLElement;
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 220, clientY: 100 }] });

    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/mein-spieltag/'));
  });

  it('navigateToTabIndex ignores out-of-range index', async () => {
    setupDefaultMocks(makeMatchdayData(), 2);
    renderMatchday('43'); // idx=1 (last game), swipe left would try idx=2 (out of range)

    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());

    // Swipe left at the last game — would try navigateToTabIndex(2) which is out of range
    const { container } = renderMatchday('43');
    await waitFor(() => expect(screen.getAllByRole('tablist')).toHaveLength(2));

    const wrapper = container.firstChild as HTMLElement;
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 220, clientY: 100 }] }); // swipe left

    // Index 2 is out of range (only [0,1] available) → no navigate
    expect(mockNavigate).not.toHaveBeenCalledWith('/mein-spieltag/46');
  });

  // ── Game header with null team names ──────────────────────────────────────

  it('renders "–" when game has homeTeam/awayTeam with no name', async () => {
    setupDefaultMocks(makeMatchdayData({
      event: {
        id: 42,
        title: 'FC Home vs FC Away',
        start: '2026-05-10T15:00:00',
        cancelled: false,
        game: {
          homeTeam: undefined,
          awayTeam: undefined,
        },
      },
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());
    // homeTeam?.name → undefined → '–' vs. awayTeam?.name → undefined → '–'
    expect(screen.getByText(/– vs\. –/)).toBeInTheDocument();
  });

  // ── Participation status without sort_order or color ────────────────────

  it('participation buttons render without sort_order or color', async () => {
    const statuses = [
      { id: 1, name: 'Keine Angabe' }, // no sort_order, no color
    ];
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url === '/api/participation/statuses') return Promise.resolve({ statuses });
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData());
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Keine Angabe' })).toBeInTheDocument());
  });

  // ── Participant without statusColor or statusCode ──────────────────────────

  it('participant with null statusColor and null statusCode uses fallback color logic', async () => {
    setupDefaultMocks(makeMatchdayData({
      role: 'coach',
      participants: [
        { userId: 1, name: 'Null User', status: 'Unbekannt', statusId: 0, statusCode: undefined as any, statusColor: undefined as any },
      ],
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Null User')).toBeInTheDocument());
  });

  // ── Ride not isMyRide (bgcolor branch) ───────────────────────────────────

  it('renders ride without isMyRide flag (uses divider borderColor)', async () => {
    setupDefaultMocks(makeMatchdayData({
      rides: [
        {
          id: 20,
          driverId: 5,
          driver: 'Fremder Fahrer',
          seats: 3,
          availableSeats: 1,
          note: null,
          isMyRide: false,
          passengers: [],
        },
      ],
      myRide: null,
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Fremder Fahrer')).toBeInTheDocument());
    expect(screen.getByText(/1 frei/)).toBeInTheDocument();
  });

  // ── coach myTasks section has spacing when allTasks non-empty ──────────────

  it('coach myTasks section has spacing when allTasks non-empty', async () => {
    setupDefaultMocks(makeMatchdayData({
      role: 'coach',
      myTasks: [
        { assignmentId: 1, taskId: 1, title: 'Eigene Aufgabe', status: 'offen', isDone: false },
      ],
      allTasks: [
        { assignmentId: 10, taskId: 1, title: 'Alle Aufgabe', status: 'offen', isDone: false, assignedTo: 'Jemand' },
      ],
    }));

    renderMatchday('42');

    await waitFor(() => expect(screen.getByText('Eigene Aufgabe')).toBeInTheDocument());
    expect(screen.getByText('Alle Aufgabe')).toBeInTheDocument();
  });

  // ── upcoming catch with eventId set (silent branch) ───────────────────────

  it('upcoming fetch failure is silent when eventId is present', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.reject(new Error('network'));
      if (url === '/api/participation/statuses') return Promise.resolve(STATUSES_RESPONSE);
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData());
      return Promise.resolve({});
    });

    renderMatchday('42'); // has eventId → upcoming error is silent

    await waitFor(() => expect(screen.getByText('FC Home vs FC Away')).toBeInTheDocument());
    // no error shown
    expect(screen.queryByText(/spieltag konnte nicht geladen werden/i)).not.toBeInTheDocument();
  });

  // ── active participation with null color (bgcolor ?? undefined) ───────────

  it('active participation button with no color uses undefined bgcolor', async () => {
    const statuses = [
      { id: 1, name: 'Zusagen' }, // no color
    ];
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url === '/api/participation/statuses') return Promise.resolve({ statuses });
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData({ myParticipation: { id: 1, status: 'Zusagen', statusId: 1 } }));
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zusagen' })).toBeInTheDocument());
    // isActive=true, status.color=undefined → bgcolor=undefined (no crash)
    const btn = screen.getByRole('button', { name: 'Zusagen' });
    expect(btn).toBeInTheDocument();
  });

  // ── sort_order defined on both sides of comparison ────────────────────────

  it('participation statuses are sorted by sort_order (both sides defined)', async () => {
    const statuses = [
      { id: 2, name: 'Absagen', color: '#dc3545', sort_order: 2 },
      { id: 1, name: 'Zusagen', color: '#28a745', sort_order: 1 },
    ];
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url === '/api/participation/statuses') return Promise.resolve({ statuses });
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData());
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zusagen' })).toBeInTheDocument());
    // Zusagen (sort_order 1) should appear before Absagen (sort_order 2)
    const buttons = screen.getAllByRole('button');
    const zusagenIdx = buttons.findIndex(b => b.textContent === 'Zusagen');
    const absagenIdx = buttons.findIndex(b => b.textContent === 'Absagen');
    expect(zusagenIdx).toBeLessThan(absagenIdx);
  });

  // ── sort with mixed sort_order (one defined, one undefined) ──────────────

  it('sort handles mixed: one status with sort_order, one without', async () => {
    const statuses = [
      { id: 1, name: 'Offen' },       // sort_order ?? 0 → 0
      { id: 2, name: 'Erledigt', sort_order: 5 }, // sort_order ?? 0 → 5
    ];
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url === '/api/participation/statuses') return Promise.resolve({ statuses });
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData());
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Offen' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Erledigt' })).toBeInTheDocument();
  });

  it('sort handles 3 statuses with mixed sort_order values (covers b.sort_order=null branch)', async () => {
    // With 3 items, V8 will compare in multiple orders including (defined, undefined)
    const statuses = [
      { id: 3, name: 'Dritter', sort_order: 3 },
      { id: 1, name: 'Erster', sort_order: 1 },
      { id: 2, name: 'Zweiter' }, // no sort_order → b.sort_order ?? 0
    ];
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url === '/api/participation/statuses') return Promise.resolve({ statuses });
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData());
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Erster' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Zweiter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dritter' })).toBeInTheDocument();
  });

  it('handleParticipation disables button while saving', async () => {
    let resolveRespond!: (v: unknown) => void;
    const respondPromise = new Promise(resolve => { resolveRespond = resolve; });

    const statuses = [{ id: 1, name: 'Zusagen', color: '#28a745', sort_order: 1 }];
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/calendar/upcoming') return Promise.resolve({ events: [makeUpcomingEvent(42, 'Spiel', '2026-05-10T15:00:00')], lookaheadDays: 7 });
      if (url === '/api/participation/statuses') return Promise.resolve({ statuses });
      if (url.startsWith('/api/matchday/') && url.endsWith('/view')) return Promise.resolve({});
      if (url.startsWith('/api/matchday/') && url.includes('/respond')) return respondPromise;
      if (url.startsWith('/api/matchday/')) return Promise.resolve(makeMatchdayData());
      return Promise.resolve({});
    });

    renderMatchday('42');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zusagen' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Zusagen' }));

    // Button must be disabled while save is in flight
    await waitFor(() => expect(screen.getByRole('button', { name: 'Zusagen' })).toBeDisabled());

    // Resolve so the component can clean up
    await act(async () => { resolveRespond({}); });
  });
});
