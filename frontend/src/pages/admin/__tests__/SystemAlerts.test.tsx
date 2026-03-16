import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import SystemAlerts from '../SystemAlerts';

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

const makeAlert = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  category: 'server_error',
  categoryLabel: 'Server-Fehler',
  categoryIcon: '🔴',
  categoryColor: '#c0392b',
  fingerprint: 'fp1',
  message: 'Unbehandelte Exception',
  requestUri: '/api/foo',
  httpMethod: 'GET',
  clientIp: '192.168.1.1',
  exceptionClass: 'RuntimeException',
  occurrenceCount: 1,
  firstOccurrenceAt: '2026-01-01T10:00:00+00:00',
  lastOccurrenceAt: '2026-01-01T10:00:00+00:00',
  isResolved: false,
  resolvedAt: null,
  resolvedNote: null,
  ...overrides,
});

const makeResponse = (overrides: Record<string, unknown> = {}) => ({
  open: [makeAlert()],
  resolved: [],
  stats: { total: 1, byCategory: { server_error: 1 } },
  ...overrides,
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function renderAndWait(response = makeResponse()) {
  mockApiJson.mockResolvedValueOnce(response);
  render(
    <MemoryRouter>
      <SystemAlerts />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SystemAlerts', () => {

  it('zeigt CircularProgress während des Ladens', () => {
    mockApiJson.mockReturnValue(new Promise(() => {})); // hängt
    render(
      <MemoryRouter>
        <SystemAlerts />
      </MemoryRouter>
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('lädt Alerts beim ersten Rendern', async () => {
    await renderAndWait();
    expect(mockApiJson).toHaveBeenCalledWith('/api/superadmin/system-alerts');
  });

  it('zeigt Alert-Nachricht im offenen Tab', async () => {
    await renderAndWait();
    expect(screen.getByText('Unbehandelte Exception')).toBeInTheDocument();
  });

  it('zeigt Kategorie-Label als Chip', async () => {
    await renderAndWait();
    expect(screen.getByText('Server-Fehler')).toBeInTheDocument();
  });

  it('zeigt ×N Badge bei mehreren Vorkommen', async () => {
    await renderAndWait(makeResponse({
      open: [makeAlert({ occurrenceCount: 5 })],
    }));
    expect(screen.getByText('×5')).toBeInTheDocument();
  });

  it('zeigt keinen Badge bei einem Vorkommen', async () => {
    await renderAndWait();
    expect(screen.queryByText('×1')).not.toBeInTheDocument();
  });

  it('zeigt IP-Adresse des Alerts', async () => {
    await renderAndWait();
    expect(screen.getByText('IP: 192.168.1.1')).toBeInTheDocument();
  });

  it('navigiert zur Detail-Seite beim Klick auf die Karte', async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText('Unbehandelte Exception'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/system-alerts/1');
  });

  it('öffnet Resolve-Dialog beim Klick auf Erledigen-Button', async () => {
    await renderAndWait();
    // MUI icons render with data-testid in test environment
    const checkIcon = screen.getByTestId('CheckCircleIcon');
    const resolveButton = checkIcon.closest('button')!;
    fireEvent.click(resolveButton);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });

  it('bestätigt Resolve und ruft API auf', async () => {
    await renderAndWait();
    mockApiJson.mockResolvedValue(makeResponse({ open: [], resolved: [makeAlert({ isResolved: true })] }));

    // Resolve-Dialog öffnen
    const checkIcon = screen.getByTestId('CheckCircleIcon');
    fireEvent.click(checkIcon.closest('button')!);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    // Bestätigungsbutton klicken
    fireEvent.click(screen.getByText('Als erledigt markieren'));

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith(
        '/api/superadmin/system-alerts/1/resolve',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('ruft Reopen-API bei erledigten Alerts auf', async () => {
    const resolvedAlert = makeAlert({ isResolved: true });
    await renderAndWait(makeResponse({
      open: [],
      resolved: [resolvedAlert],
      stats: { total: 0, byCategory: {} },
    }));

    // Tab "Erledigt" anklicken
    fireEvent.click(screen.getByText('Erledigt'));

    // Warten bis Tab-Inhalt sichtbar
    await waitFor(() => expect(screen.getByText('Unbehandelte Exception')).toBeInTheDocument());

    mockApiJson.mockResolvedValue(makeResponse());

    // Reopen-Button über ReplayIcon finden
    const replayIcon = screen.getByTestId('ReplayIcon');
    fireEvent.click(replayIcon.closest('button')!);

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith(
        '/api/superadmin/system-alerts/1/reopen',
        { method: 'POST' }
      )
    );
  });

  it('zeigt Erfolgs-Alert wenn keine offenen Alerts', async () => {
    await renderAndWait(makeResponse({
      open: [],
      resolved: [],
      stats: { total: 0, byCategory: {} },
    }));
    expect(screen.getByText(/Keine offenen Alerts/)).toBeInTheDocument();
  });

  it('zeigt Kategorie-Summary-Chips wenn offene Alerts vorhanden', async () => {
    await renderAndWait(makeResponse({
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));
    expect(screen.getByText(/1 Server-Fehler/)).toBeInTheDocument();
  });

  it('navigiert zu /admin/system-alerts/stats beim Klick auf Trend-Analyse', async () => {
    await renderAndWait();
    fireEvent.click(screen.getByText('Trend-Analyse'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/system-alerts/stats');
  });

  it('zeigt Fehler-Alert bei API-Fehler', async () => {
    mockApiJson.mockRejectedValueOnce(new Error('Network error'));
    render(
      <MemoryRouter>
        <SystemAlerts />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByText('Fehler beim Laden der System-Alerts.')).toBeInTheDocument()
    );
  });

  it('zeigt "Keine Einträge" wenn der aktive Tab leer ist', async () => {
    await renderAndWait(makeResponse({ open: [], stats: { total: 0, byCategory: {} } }));
    expect(screen.getByText('Keine Einträge in dieser Kategorie.')).toBeInTheDocument();
  });

  // ── suspicious_request Kategorie ──────────────────────────────────────────

  it('zeigt suspicious_request Alert mit korrektem Label', async () => {
    await renderAndWait(makeResponse({
      open: [makeAlert({
        id: 99,
        category: 'suspicious_request',
        categoryLabel: 'Scan/Hack-Versuch',
        categoryColor: '#d84315',
        message: 'Verdächtige Anfrage: GET /.env',
      })],
      stats: { total: 1, byCategory: { suspicious_request: 1 } },
    }));
    expect(screen.getByText('Scan/Hack-Versuch')).toBeInTheDocument();
    expect(screen.getByText('Verdächtige Anfrage: GET /.env')).toBeInTheDocument();
  });

  it('zeigt suspicious_request Category-Chip in Summary', async () => {
    await renderAndWait(makeResponse({
      open: [makeAlert({ category: 'suspicious_request', categoryLabel: 'Scan/Hack-Versuch' })],
      stats: { total: 2, byCategory: { suspicious_request: 2 } },
    }));
    expect(screen.getByText('2 Scan/Hack-Versuch')).toBeInTheDocument();
  });
});
