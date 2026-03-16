import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SystemAlertDetail from '../SystemAlertDetail';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../utils/api', () => ({
  apiJson: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

import { apiJson } from '../../../utils/api';
const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeDetail = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  category: 'server_error',
  categoryLabel: 'Server-Fehler',
  categoryColor: '#c0392b',
  message: 'RuntimeException: Division by zero',
  requestUri: '/api/calc',
  httpMethod: 'POST',
  clientIp: '10.0.0.5',
  exceptionClass: 'RuntimeException',
  stackTrace: '#0 src/Service/Calc.php(42): divide()',
  context: { input: 5, divisor: 0 },
  occurrenceCount: 3,
  firstOccurrenceAt: '2026-01-01T08:00:00+00:00',
  lastOccurrenceAt:  '2026-01-01T10:00:00+00:00',
  isResolved: false,
  resolvedAt: null,
  resolvedNote: null,
  ...overrides,
});

// ── Helper ────────────────────────────────────────────────────────────────────

function renderWithRoute(alertId: string | number = 42) {
  return render(
    <MemoryRouter initialEntries={[`/admin/system-alerts/${alertId}`]}>
      <Routes>
        <Route path="/admin/system-alerts/:id" element={<SystemAlertDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

async function renderAndWait(detail = makeDetail(), alertId: string | number = 42) {
  mockApiJson.mockResolvedValueOnce(detail);
  renderWithRoute(alertId);
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SystemAlertDetail', () => {

  it('zeigt CircularProgress während des Ladens', () => {
    mockApiJson.mockReturnValue(new Promise(() => {}));
    renderWithRoute();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('ruft die korrekte API-URL auf', async () => {
    await renderAndWait(makeDetail(), 42);
    expect(mockApiJson).toHaveBeenCalledWith('/api/superadmin/system-alerts/42');
  });

  it('zeigt die Alert-Nachricht an', async () => {
    await renderAndWait();
    expect(screen.getByText('RuntimeException: Division by zero')).toBeInTheDocument();
  });

  it('zeigt die Kategorie an', async () => {
    await renderAndWait();
    expect(screen.getByText('Server-Fehler')).toBeInTheDocument();
  });

  it('zeigt die Client-IP an', async () => {
    await renderAndWait();
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument();
  });

  it('zeigt den Stack Trace an', async () => {
    await renderAndWait();
    expect(screen.getByText('#0 src/Service/Calc.php(42): divide()')).toBeInTheDocument();
  });

  it('zeigt den Exception-Typ an', async () => {
    await renderAndWait();
    expect(screen.getByText('RuntimeException')).toBeInTheDocument();
  });

  it('zeigt die Anzahl der Vorkommen an', async () => {
    await renderAndWait();
    // occurrenceCount > 1 renders as a chip: "3× aufgetreten"
    expect(screen.getByText('3× aufgetreten')).toBeInTheDocument();
  });

  it('zeigt Kontext-JSON an', async () => {
    await renderAndWait();
    // Kontext wird als JSON-String gerendert
    expect(screen.getByText(/"input": 5/)).toBeInTheDocument();
  });

  it('zeigt Breadcrumb-Navigation zurück zur Liste', async () => {
    await renderAndWait();
    expect(screen.getByText('System-Alerts')).toBeInTheDocument();
  });

  it('zeigt Resolve-Button bei offenem Alert', async () => {
    await renderAndWait();
    // Button zum Resolve vorhanden
    expect(screen.getByText(/Als erledigt|Erledigen|Resolve/i)).toBeInTheDocument();
  });

  it('zeigt Reopen-Button bei bereits erledigtem Alert', async () => {
    await renderAndWait(makeDetail({
      isResolved: true,
      resolvedAt: '2026-01-02T09:00:00+00:00',
      resolvedNote: 'Fixed',
    }));
    expect(screen.getByText('Wieder öffnen')).toBeInTheDocument();
  });

  it('zeigt Resolve-Notiz bei erledigtem Alert', async () => {
    await renderAndWait(makeDetail({
      isResolved: true,
      resolvedAt: '2026-01-02T09:00:00+00:00',
      resolvedNote: 'Bugfix deployed',
    }));
    expect(screen.getByText('Bugfix deployed')).toBeInTheDocument();
  });

  it('öffnet Resolve-Dialog beim Klick auf Erledigen-Button', async () => {
    await renderAndWait();
    const resolveButton = screen.getByText(/Als erledigt|Erledigen/i);
    fireEvent.click(resolveButton);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });

  it('ruft Resolve-API auf nach Bestätigung im Dialog', async () => {
    await renderAndWait();
    mockApiJson.mockResolvedValue(makeDetail({ isResolved: true, resolvedAt: '2026-01-02T09:00:00+00:00' }));

    fireEvent.click(screen.getByText(/Als erledigt|Erledigen/i));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    // Notiz eintragen
    const noteInput = screen.queryByLabelText(/Notiz|Note/i);
    if (noteInput) fireEvent.change(noteInput, { target: { value: 'Fixed!' } });

    // Bestätigen
    fireEvent.click(screen.getByText('Bestätigen'));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith(
        '/api/superadmin/system-alerts/42/resolve',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('ruft Reopen-API auf', async () => {
    await renderAndWait(makeDetail({ isResolved: true, resolvedAt: '2026-01-02T09:00:00+00:00' }));
    mockApiJson.mockResolvedValue(makeDetail());

    fireEvent.click(screen.getByText('Wieder öffnen'));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith(
        '/api/superadmin/system-alerts/42/reopen',
        { method: 'POST' }
      )
    );
  });

  it('zeigt Fehler-Meldung bei Lade-Fehler', async () => {
    mockApiJson.mockRejectedValueOnce(new Error('Not found'));
    renderWithRoute(99);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
  });

  it('zeigt keinen Stack-Trace-Block wenn keiner vorhanden', async () => {
    await renderAndWait(makeDetail({ stackTrace: null }));
    expect(screen.queryByText(/Stack Trace/i)).not.toBeInTheDocument();
  });

  it('zeigt keinen Kontext-Block wenn keiner vorhanden', async () => {
    await renderAndWait(makeDetail({ context: null }));
    expect(screen.queryByText(/Kontext/i)).not.toBeInTheDocument();
  });
});
