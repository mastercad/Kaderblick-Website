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
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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
  // Suppress console errors from expected API failures
  jest.spyOn(console, 'error').mockImplementation(() => {});
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
});
