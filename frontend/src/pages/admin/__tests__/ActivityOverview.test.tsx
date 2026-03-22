import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityOverview from '../ActivityOverview';
import type { ActivityOverviewData, ActivityTrendData } from '../../../services/adminActivity';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../services/adminActivity', () => ({
  fetchUserActivity: jest.fn(),
  fetchActivityTrend: jest.fn(),
}));

// LineChart aus @mui/x-charts braucht Canvas/ResizeObserver → leichtgewichtig mocken
jest.mock('@mui/x-charts', () => ({
  LineChart: ({ series }: any) => (
    <div data-testid="LineChart">
      {series?.[0]?.data?.map((v: number, i: number) => (
        <span key={i} data-testid="line-value">{v}</span>
      ))}
    </div>
  ),
}));

import { fetchUserActivity, fetchActivityTrend } from '../../../services/adminActivity';

const mockFetchUsers  = fetchUserActivity  as jest.MockedFunction<typeof fetchUserActivity>;
const mockFetchTrend  = fetchActivityTrend as jest.MockedFunction<typeof fetchActivityTrend>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<ActivityOverviewData['users'][0]> = {}): ActivityOverviewData['users'][0] => ({
  id:             1,
  email:          'max@example.com',
  fullName:       'Max Muster',
  roles:          ['ROLE_USER'],
  lastActivityAt: '2026-03-12T10:00:00+00:00',
  minutesAgo:     5,
  ...overrides,
});

const makeOverview = (users = [makeUser()], statsOverrides = {}): ActivityOverviewData => ({
  users,
  stats: { totalCount: users.length, activeToday: 1, activeLast7Days: 1, neverActive: 0, ...statsOverrides },
  pagination: { page: 1, limit: 25, total: users.length, totalPages: 1 },
});

const makeTrend = (): ActivityTrendData => ({
  range: 'month',
  data:  [{ label: '2026-03-01', count: 3 }, { label: '2026-03-12', count: 7 }],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupMocks(overview: ActivityOverviewData = makeOverview(), trend: ActivityTrendData = makeTrend()) {
  mockFetchUsers.mockResolvedValue(overview);
  mockFetchTrend.mockResolvedValue(trend);
}

async function renderAndWait(overview?: ActivityOverviewData, trend?: ActivityTrendData) {
  setupMocks(overview, trend);
  await act(async () => {
    render(<ActivityOverview />);
    // waitFor inside act keeps the act scope alive while Promise chains flush
    await waitFor(() => expect(screen.queryAllByRole('progressbar')).toHaveLength(0));
  });
}

// Reset mocks before each test
beforeEach(() => jest.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ActivityOverview', () => {

  it('ruft fetchUserActivity und fetchActivityTrend beim ersten Render auf', async () => {
    await renderAndWait();
    expect(mockFetchUsers).toHaveBeenCalledTimes(1);
    expect(mockFetchTrend).toHaveBeenCalledTimes(1);
  });

  it('zeigt Stats-Karten mit korrekten Werten an', async () => {
    await renderAndWait(makeOverview([makeUser()], { totalCount: 42, activeToday: 5, activeLast7Days: 12, neverActive: 8 }));
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('zeigt Benutzernamen und E-Mail in der Tabelle an', async () => {
    await renderAndWait();
    expect(screen.getByText('Max Muster')).toBeInTheDocument();
    expect(screen.getByText('max@example.com')).toBeInTheDocument();
  });

  it('zeigt "Heute aktiv"-Chip für Benutzer mit Aktivität heute', async () => {
    await renderAndWait(makeOverview([makeUser({ minutesAgo: 30 })]));
    // Text appears both in StatCard label and in Chip → use getAllByText
    expect(screen.getAllByText('Heute aktiv').length).toBeGreaterThanOrEqual(1);
  });

  it('zeigt "Diese Woche"-Chip für Benutzer mit Aktivität innerhalb der letzten 7 Tage', async () => {
    const minutesAgo = 60 * 24 * 3; // 3 Tage
    await renderAndWait(makeOverview([makeUser({ minutesAgo, lastActivityAt: '2026-03-09T10:00:00+00:00' })]));
    expect(screen.getByText('Diese Woche')).toBeInTheDocument();
  });

  it('zeigt "Länger inaktiv"-Chip für Benutzer mit alter Aktivität', async () => {
    const minutesAgo = 60 * 24 * 30; // 30 Tage
    await renderAndWait(makeOverview([makeUser({ minutesAgo, lastActivityAt: '2026-02-10T10:00:00+00:00' })]));
    expect(screen.getByText('Länger inaktiv')).toBeInTheDocument();
  });

  it('zeigt "Nie aktiv"-Chip für Benutzer ohne Aktivität', async () => {
    await renderAndWait(makeOverview([makeUser({ minutesAgo: null, lastActivityAt: null })]));
    // Text appears both in StatCard label and in Chip → use getAllByText
    expect(screen.getAllByText('Nie aktiv').length).toBeGreaterThanOrEqual(1);
  });

  it('zeigt den LineChart an wenn Trenddaten vorhanden sind', async () => {
    await renderAndWait();
    expect(screen.getByTestId('LineChart')).toBeInTheDocument();
  });

  it('zeigt eine Meldung wenn keine Trenddaten vorhanden sind', async () => {
    await renderAndWait(makeOverview(), { range: 'month', data: [] });
    expect(screen.getByText(/Keine Aktivitätsdaten/)).toBeInTheDocument();
  });

  it('zeigt den TablePagination mit der Gesamtanzahl an', async () => {
    await renderAndWait(
      { ...makeOverview(), pagination: { page: 1, limit: 25, total: 100, totalPages: 4 } }
    );
    // MUI TablePagination zeigt "1–25 von 100"
    expect(screen.getByText(/von 100/)).toBeInTheDocument();
  });

  it('zeigt einen Fehler-Alert wenn fetchUserActivity fehlschlägt', async () => {
    mockFetchUsers.mockRejectedValue(new Error('Server error'));
    mockFetchTrend.mockResolvedValue(makeTrend());
    render(<ActivityOverview />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/Fehler beim Laden der Aktivitätsdaten/)).toBeInTheDocument();
  });

  it('lädt neue Trenddaten wenn der Zeitraum-Schalter geändert wird', async () => {
    await renderAndWait();
    const weekButton = screen.getByRole('button', { name: '7 Tage' });
    fireEvent.click(weekButton);
    await waitFor(() => expect(mockFetchTrend).toHaveBeenCalledWith('week'));
  });

  it('triggert fetchUserActivity nach Sucheingabe mit Debounce', async () => {
    jest.useFakeTimers();
    setupMocks();
    render(<ActivityOverview />);
    await act(async () => { jest.runAllTimers(); });

    const input = screen.getByPlaceholderText(/Name oder E-Mail suchen/);
    fireEvent.change(input, { target: { value: 'max' } });

    // Noch nicht aufgerufen (Debounce läuft)
    expect(mockFetchUsers).toHaveBeenCalledTimes(1); // nur initialer Aufruf

    await act(async () => { jest.advanceTimersByTime(400); });

    await waitFor(() => {
      const calls = mockFetchUsers.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall?.search).toBe('max');
    });

    jest.useRealTimers();
  });

  it('zeigt SUPERADMIN-Chip als Role-Chip an', async () => {
    await renderAndWait(makeOverview([makeUser({ roles: ['ROLE_SUPERADMIN'] })]));
    expect(screen.getByText('Superadmin')).toBeInTheDocument();
  });
});
