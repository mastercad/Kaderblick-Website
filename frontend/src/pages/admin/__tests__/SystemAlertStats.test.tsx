import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import SystemAlertStats from '../SystemAlertStats';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../utils/api', () => ({
  apiJson: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// LineChart aus @mui/x-charts/LineChart braucht Canvas → leichtgewichtig mocken
jest.mock('@mui/x-charts/LineChart', () => ({
  LineChart: ({ series, xAxis }: any) => (
    <div data-testid="LineChart">
      {series?.map((s: any, i: number) => (
        <div key={i} data-testid={`series-${s.label ?? i}`}>
          {s.data?.map((v: number, j: number) => (
            <span key={j} data-testid="data-point">{v}</span>
          ))}
        </div>
      ))}
      {xAxis?.[0]?.data?.map((label: string, i: number) => (
        <span key={i} data-testid="x-label">{label}</span>
      ))}
    </div>
  ),
}));

import { apiJson } from '../../../utils/api';
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeTrend = (overrides?: Partial<{ current: number; previous: number; direction: string; changePercent: number }>) => ({
  current: 10,
  previous: 5,
  direction: 'up' as const,
  changePercent: 100,
  ...overrides,
});

const makeResponse = (overrides: Record<string, unknown> = {}) => ({
  period: '7d',
  bucketSize: 'day' as const,
  timeSeries: [
    { bucket: '2026-01-05', category: 'server_error',       count: 3 },
    { bucket: '2026-01-06', category: 'login_failure',      count: 2 },
    { bucket: '2026-01-07', category: 'server_error',       count: 5 },
    { bucket: '2026-01-07', category: 'suspicious_request', count: 4 },
  ],
  trends: {
    server_error:        makeTrend({ current: 8, previous: 4, direction: 'up',      changePercent: 100 }),
    login_failure:       makeTrend({ current: 2, previous: 6, direction: 'down',    changePercent: -67 }),
    brute_force:         makeTrend({ current: 1, previous: 1, direction: 'neutral', changePercent: 0 }),
    suspicious_request:  makeTrend({ current: 4, previous: 2, direction: 'up',      changePercent: 200 }),
  },
  totals: {
    server_error:        8,
    login_failure:       2,
    brute_force:         1,
    suspicious_request:  4,
  },
  ...overrides,
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function renderAndWait(response = makeResponse()) {
  mockApiJson.mockResolvedValueOnce(response);
  render(
    <MemoryRouter>
      <SystemAlertStats />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SystemAlertStats', () => {

  it('zeigt CircularProgress während des Ladens', () => {
    mockApiJson.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <SystemAlertStats />
      </MemoryRouter>
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('lädt Statistiken beim ersten Rendern mit Standardperiode 7d', async () => {
    await renderAndWait();
    expect(mockApiJson).toHaveBeenCalledWith(
      expect.stringContaining('/api/superadmin/system-alerts/stats?period=7d')
    );
  });

  it('zeigt den LineChart an', async () => {
    await renderAndWait();
    expect(screen.getByTestId('LineChart')).toBeInTheDocument();
  });

  it('zeigt alle drei Kategorien als TrendCards', async () => {
    await renderAndWait();
    expect(screen.getByText('Server-Fehler')).toBeInTheDocument();
    expect(screen.getByText('Login-Fehler')).toBeInTheDocument();
    expect(screen.getByText('Brute Force')).toBeInTheDocument();
  });

  it('zeigt die vierte Kategorie Hack-Versuche als TrendCard', async () => {
    await renderAndWait();
    expect(screen.getByText('Hack-Versuche')).toBeInTheDocument();
  });

  it('zeigt Trend-Gesamtzahlen in den Karten', async () => {
    await renderAndWait();
    // totals werden als <h4> gerendert (MUI variant="h4")
    expect(screen.getByRole('heading', { level: 4, name: '8' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: '4' })).toBeInTheDocument();
  });

  it('wechselt zur Period 24h bei Klick auf Toggle-Button', async () => {
    await renderAndWait();

    mockApiJson.mockResolvedValueOnce(makeResponse({ period: '24h', bucketSize: 'hour' }));

    fireEvent.click(screen.getByText('24h'));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenLastCalledWith(
        expect.stringContaining('period=24h')
      )
    );
  });

  it('wechselt zur Period 30d bei Klick auf Toggle-Button', async () => {
    await renderAndWait();

    mockApiJson.mockResolvedValueOnce(makeResponse({ period: '30d', bucketSize: 'day' }));

    fireEvent.click(screen.getByText('30 Tage'));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenLastCalledWith(
        expect.stringContaining('period=30d')
      )
    );
  });

  it('zeigt Trend-Richtung ↑ bei steigendem Trend', async () => {
    await renderAndWait();
    // TrendingUpIcon wird gerendert – MUI Icons haben Titel-Attribute
    // Alternativ: data-testid prüfen in der Komponente nicht vorhanden,
    // stattdessen prüfen wir Prozentangabe
    expect(screen.getByText('+100% vs. Vorperiode')).toBeInTheDocument();
  });

  it('zeigt Trend-Richtung ↓ bei sinkendem Trend', async () => {
    await renderAndWait();
    expect(screen.getByText('-67% vs. Vorperiode')).toBeInTheDocument();
  });

  it('zeigt 0% bei stabilem Trend (neutral)', async () => {
    await renderAndWait();
    expect(screen.getByText('Stabil vs. Vorperiode')).toBeInTheDocument();
  });

  it('zeigt Hinweis-Text zur Interpretation', async () => {
    await renderAndWait();
    expect(screen.getByText('So liest du die Trends')).toBeInTheDocument();
  });

  it('zeigt Breadcrumb zurück zur Liste', async () => {
    await renderAndWait();
    expect(screen.getByText('System-Alerts')).toBeInTheDocument();
  });

  it('navigiert zur Listen-Seite beim Klick auf Breadcrumb', async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText('System-Alerts'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/system-alerts');
  });

  it('zeigt Hinweis wenn keine Zeitreihendaten vorhanden', async () => {
    await renderAndWait(makeResponse({ timeSeries: [] }));
    expect(screen.getByText('Keine Daten für diesen Zeitraum.')).toBeInTheDocument();
  });

  it('zeigt Fehlermeldung bei API-Fehler', async () => {
    mockApiJson.mockRejectedValueOnce(new Error('Server error'));
    render(
      <MemoryRouter>
        <SystemAlertStats />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
  });

  it('enthält Datenpunkte im Chart für vorhandene Zeitreihendaten', async () => {
    await renderAndWait();
    // Chart-Datenpunkte prüfen (aus dem Mock gerendert)
    const dataPoints = screen.getAllByTestId('data-point');
    expect(dataPoints.length).toBeGreaterThan(0);
  });
});
