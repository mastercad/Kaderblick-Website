/**
 * Tests für AlertsTab
 *
 * Prüft: Lade-States, Fehlerstates, Alertliste (offen/erledigt),
 * Kategorie-Filter, Resolve-Dialog, Reopen, Navigation, Snackbar.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AlertsTab from '../AlertsTab';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockApiJson = jest.fn();
jest.mock('../../../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeAlert = (overrides: Partial<{
  id: number; category: string; categoryLabel: string; categoryIcon: string;
  categoryColor: string; fingerprint: string; message: string;
  requestUri: string | null; httpMethod: string | null; clientIp: string | null;
  exceptionClass: string | null; occurrenceCount: number;
  firstOccurrenceAt: string; lastOccurrenceAt: string;
  isResolved: boolean; resolvedAt: string | null; resolvedNote: string | null;
}> = {}) => ({
  id: 1,
  category: 'server_error',
  categoryLabel: 'Server-Fehler',
  categoryIcon: 'bug',
  categoryColor: 'error',
  fingerprint: 'abc123',
  message: 'Ein Testfehler ist aufgetreten',
  requestUri: '/api/test',
  httpMethod: 'GET',
  clientIp: '127.0.0.1',
  exceptionClass: null,
  occurrenceCount: 1,
  firstOccurrenceAt: '2025-01-01T10:00:00.000Z',
  lastOccurrenceAt: '2025-01-01T12:00:00.000Z',
  isResolved: false,
  resolvedAt: null,
  resolvedNote: null,
  ...overrides,
});

const makeResponse = (overrides: Partial<{
  open: ReturnType<typeof makeAlert>[];
  resolved: ReturnType<typeof makeAlert>[];
  stats: { total: number; byCategory: Record<string, number> };
}> = {}) => ({
  open: [makeAlert()],
  resolved: [],
  stats: { total: 1, byCategory: { server_error: 1 } },
  ...overrides,
});

const renderTab = (onCountChange?: jest.Mock) => {
  render(
    <MemoryRouter>
      <AlertsTab onCountChange={onCountChange} />
    </MemoryRouter>
  );
};

// ─── Hilfsfunktion ────────────────────────────────────────────────────────────

async function renderAndLoad(response = makeResponse()) {
  mockApiJson.mockResolvedValueOnce(response);
  const onCountChange = jest.fn();
  renderTab(onCountChange);
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  return { onCountChange };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetAllMocks();
  mockNavigate.mockReset();
});

// ── Lade-State ──────────────────────────────────────────────────────────────

describe('Lade-State', () => {
  it('zeigt CircularProgress während des Ladens', () => {
    mockApiJson.mockReturnValue(new Promise(() => {})); // hängt
    renderTab();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('zeigt Fehlermeldung wenn API fehlschlägt', async () => {
    mockApiJson.mockRejectedValueOnce(new Error('Netzwerkfehler'));
    renderTab();
    await waitFor(() =>
      expect(screen.getByText(/Fehler beim Laden der System-Alerts/i)).toBeInTheDocument()
    );
  });

  it('rendert nichts wenn data null ist (kein Aufruf)', async () => {
    // Wenn API hängt wird Spinner angezeigt, kein Alert-Inhalt
    mockApiJson.mockReturnValue(new Promise(() => {}));
    renderTab();
    expect(screen.queryByText(/Offen/)).not.toBeInTheDocument();
  });
});

// ── Leer-State (keine Alerts) ───────────────────────────────────────────────

describe('Keine Alerts', () => {
  it('zeigt Erfolgs-Alert wenn keine Alerts vorhanden', async () => {
    await renderAndLoad(makeResponse({
      open: [],
      resolved: [],
      stats: { total: 0, byCategory: {} },
    }));
    expect(screen.getByText(/Keine offenen Alerts/i)).toBeInTheDocument();
  });

  it('zeigt keine Filter-Chips wenn total=0', async () => {
    await renderAndLoad(makeResponse({
      open: [],
      resolved: [],
      stats: { total: 0, byCategory: {} },
    }));
    expect(screen.queryByText('Filter:')).not.toBeInTheDocument();
  });
});

// ── Alert-Liste ──────────────────────────────────────────────────────────────

describe('Alert-Liste', () => {
  it('zeigt Alert-Nachricht', async () => {
    await renderAndLoad();
    expect(screen.getByText('Ein Testfehler ist aufgetreten')).toBeInTheDocument();
  });

  it('zeigt IP-Adresse des Clients', async () => {
    await renderAndLoad();
    expect(screen.getByText(/IP: 127\.0\.0\.1/)).toBeInTheDocument();
  });

  it('zeigt HTTP-Methode und URI', async () => {
    await renderAndLoad();
    expect(screen.getByText(/GET \/api\/test/)).toBeInTheDocument();
  });

  it('zeigt occurrenceCount-Chip wenn > 1', async () => {
    await renderAndLoad(makeResponse({
      open: [makeAlert({ occurrenceCount: 5 })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));
    expect(screen.getByText('×5')).toBeInTheDocument();
  });

  it('zeigt keinen occurrenceCount-Chip wenn Wert 1 ist', async () => {
    await renderAndLoad();
    expect(screen.queryByText(/×1/)).not.toBeInTheDocument();
  });

  it('zeigt kein clientIp wenn null', async () => {
    await renderAndLoad(makeResponse({
      open: [makeAlert({ clientIp: null })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));
    expect(screen.queryByText(/IP:/)).not.toBeInTheDocument();
  });

  it('zeigt keine URI wenn requestUri null ist', async () => {
    await renderAndLoad(makeResponse({
      open: [makeAlert({ requestUri: null, httpMethod: null })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));
    expect(screen.queryByText(/GET /)).not.toBeInTheDocument();
  });

  it('navigiert zur Alert-Detail-Seite beim Klick auf eine Alert-Card', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByText('Ein Testfehler ist aufgetreten'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/system-alerts/1');
  });
});

// ── onCountChange-Callback ───────────────────────────────────────────────────

describe('onCountChange', () => {
  it('ruft onCountChange mit der Anzahl offener Alerts auf', async () => {
    const { onCountChange } = await renderAndLoad(makeResponse({
      open: [makeAlert(), makeAlert({ id: 2 })],
      stats: { total: 2, byCategory: { server_error: 2 } },
    }));
    expect(onCountChange).toHaveBeenCalledWith(2);
  });

  it('ruft onCountChange mit 0 auf wenn keine offenen Alerts', async () => {
    const { onCountChange } = await renderAndLoad(makeResponse({
      open: [],
      stats: { total: 0, byCategory: {} },
    }));
    expect(onCountChange).toHaveBeenCalledWith(0);
  });
});

// ── Tabs (Offen / Erledigt) ──────────────────────────────────────────────────

describe('Status-Tabs', () => {
  it('rendert "Offen" und "Erledigt" Tabs', async () => {
    await renderAndLoad();
    expect(screen.getByRole('tab', { name: /Offen/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Erledigt/i })).toBeInTheDocument();
  });

  it('zeigt erledigte Alerts im "Erledigt"-Tab', async () => {
    await renderAndLoad(makeResponse({
      open: [],
      resolved: [makeAlert({ id: 2, message: 'Erledigter Alert', isResolved: true })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));
    fireEvent.click(screen.getByRole('tab', { name: /Erledigt/i }));
    expect(screen.getByText('Erledigter Alert')).toBeInTheDocument();
  });

  it('zeigt leere Meldung wenn keine Einträge in Kategorie vorhanden', async () => {
    await renderAndLoad(makeResponse({ open: [] }));
    expect(screen.getByText(/Keine Einträge in dieser Kategorie/i)).toBeInTheDocument();
  });
});

// ── Kategorie-Filter ─────────────────────────────────────────────────────────

describe('Kategorie-Filter', () => {
  it('zeigt Filter-Chips für jede Kategorie in stats.byCategory', async () => {
    await renderAndLoad(makeResponse({
      open: [makeAlert({ category: 'server_error' })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));
    // Filter-Chip zeigt "1 Server-Fehler" (count + label)
    expect(screen.getByText('1 Server-Fehler')).toBeInTheDocument();
  });

  it('blendet Alerts einer Kategorie aus nach Klick auf Filter-Chip', async () => {
    await renderAndLoad(makeResponse({
      open: [makeAlert({ category: 'server_error', message: 'Sichtbarer Alert' })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));

    // Vor dem Klick ist der Alert sichtbar
    expect(screen.getByText('Sichtbarer Alert')).toBeInTheDocument();

    // Klick auf Kategorie-Filter-Chip ("1 Server-Fehler")
    fireEvent.click(screen.getByText('1 Server-Fehler'));

    // Alert ist jetzt ausgeblendet
    expect(screen.queryByText('Sichtbarer Alert')).not.toBeInTheDocument();
  });

  it('zeigt "Alle Typen ausgeblendet" wenn alle gefiltert', async () => {
    await renderAndLoad(makeResponse({
      open: [makeAlert({ category: 'server_error', message: 'Versteckter Alert' })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));

    fireEvent.click(screen.getByText('1 Server-Fehler'));

    expect(screen.getByText(/Alle Typen ausgeblendet/i)).toBeInTheDocument();
  });

  it('zeigt "Alle zeigen" Chip wenn mindestens eine Kategorie ausgeblendet', async () => {
    await renderAndLoad(makeResponse({
      open: [makeAlert({ category: 'server_error' })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));

    fireEvent.click(screen.getByText('1 Server-Fehler'));
    expect(screen.getByText('Alle zeigen')).toBeInTheDocument();
  });

  it('zeigt wieder alle Alerts nach Klick auf "Alle zeigen"', async () => {
    await renderAndLoad(makeResponse({
      open: [makeAlert({ category: 'server_error', message: 'Wieder sichtbar' })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));

    fireEvent.click(screen.getByText('1 Server-Fehler')); // ausblenden
    fireEvent.click(screen.getByText('Alle zeigen'));      // wieder einblenden

    expect(screen.getByText('Wieder sichtbar')).toBeInTheDocument();
  });

  it('zeigt keinen "Alle zeigen" Chip wenn nichts ausgeblendet', async () => {
    await renderAndLoad();
    expect(screen.queryByText('Alle zeigen')).not.toBeInTheDocument();
  });
});

// ── Kategorie-Icons und -Farben ──────────────────────────────────────────────

describe('Kategorie-Varianten', () => {
  const categories = [
    'server_error', 'login_failure', 'brute_force',
    'suspicious_request', 'queue_failure', 'disk_space', 'cron_failure', 'unknown_cat',
  ];

  it.each(categories)('rendert Alert mit category="%s" ohne Fehler', async (category) => {
    await renderAndLoad(makeResponse({
      open: [makeAlert({ category, categoryLabel: category })],
      stats: { total: 1, byCategory: { [category]: 1 } },
    }));
    expect(screen.getByText('Ein Testfehler ist aufgetreten')).toBeInTheDocument();
  });
});

// ── Resolve-Dialog ────────────────────────────────────────────────────────────

describe('Resolve-Dialog', () => {
  it('öffnet Resolve-Dialog beim Klick auf CheckCircle-Button', async () => {
    await renderAndLoad();
    const resolveBtn = screen.getByRole('button', { name: /Als erledigt markieren/i });
    fireEvent.click(resolveBtn);
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    );
  });

  it('schließt Dialog beim Klick auf Abbrechen', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByRole('button', { name: /Als erledigt markieren/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Abbrechen/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('schließt Dialog beim Klick auf Schließen-Icon', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByRole('button', { name: /Als erledigt markieren/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Schließen/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sendet POST-Request mit Note wenn Dialog bestätigt wird', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByRole('button', { name: /Als erledigt markieren/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    // Notiz eingeben
    const textarea = within(screen.getByRole('dialog')).getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Problem behoben' } });

    // Bestätigen – API muss resolve + reload liefern
    mockApiJson
      .mockResolvedValueOnce({})                  // resolve-Aufruf
      .mockResolvedValueOnce(makeResponse({ open: [] })); // reload

    const confirmBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /Als erledigt markieren/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(
        expect.stringContaining('/resolve'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('zeigt Snackbar-Erfolgsmeldung nach Resolve', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByRole('button', { name: /Als erledigt markieren/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    mockApiJson
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(makeResponse({ open: [] }));

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Als erledigt markieren/i })
    );

    await waitFor(() =>
      expect(screen.getByText(/Alert als erledigt markiert/i)).toBeInTheDocument()
    );
  });

  it('zeigt Fehlermeldung in Snackbar wenn Resolve API fehlschlägt', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByRole('button', { name: /Als erledigt markieren/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    mockApiJson.mockRejectedValueOnce(new Error('Resolve fehlgeschlagen'));

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Als erledigt markieren/i })
    );

    await waitFor(() =>
      expect(screen.getByText(/Fehler beim Aktualisieren/i)).toBeInTheDocument()
    );
  });
});

// ── Reopen ────────────────────────────────────────────────────────────────────

describe('Reopen', () => {
  it('zeigt "Wieder öffnen"-Button für erledigte Alerts', async () => {
    await renderAndLoad(makeResponse({
      open: [],
      resolved: [makeAlert({ id: 2, isResolved: true })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));

    fireEvent.click(screen.getByRole('tab', { name: /Erledigt/i }));
    expect(await screen.findByRole('button', { name: /Wieder öffnen/i })).toBeInTheDocument();
  });

  it('ruft reopen-API auf', async () => {
    await renderAndLoad(makeResponse({
      open: [],
      resolved: [makeAlert({ id: 42, isResolved: true })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));

    fireEvent.click(screen.getByRole('tab', { name: /Erledigt/i }));
    const reopenBtn = await screen.findByRole('button', { name: /Wieder öffnen/i });

    mockApiJson
      .mockResolvedValueOnce({})                  // reopen
      .mockResolvedValueOnce(makeResponse());      // reload

    fireEvent.click(reopenBtn);

    await waitFor(() =>
      expect(mockApiJson).toHaveBeenCalledWith(
        expect.stringContaining('/42/reopen'),
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('zeigt Snackbar nach Reopen', async () => {
    await renderAndLoad(makeResponse({
      open: [],
      resolved: [makeAlert({ id: 2, isResolved: true })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));

    fireEvent.click(screen.getByRole('tab', { name: /Erledigt/i }));
    const reopenBtn = await screen.findByRole('button', { name: /Wieder öffnen/i });

    mockApiJson
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(makeResponse());

    fireEvent.click(reopenBtn);
    await waitFor(() =>
      expect(screen.getByText(/Alert wieder geöffnet/i)).toBeInTheDocument()
    );
  });

  it('zeigt Fehler-Snackbar wenn Reopen fehlschlägt', async () => {
    await renderAndLoad(makeResponse({
      open: [],
      resolved: [makeAlert({ id: 2, isResolved: true })],
      stats: { total: 1, byCategory: { server_error: 1 } },
    }));

    fireEvent.click(screen.getByRole('tab', { name: /Erledigt/i }));
    const reopenBtn = await screen.findByRole('button', { name: /Wieder öffnen/i });

    mockApiJson.mockRejectedValueOnce(new Error('Reopen-Fehler'));
    fireEvent.click(reopenBtn);
    await waitFor(() =>
      expect(screen.getByText(/Fehler beim Aktualisieren/i)).toBeInTheDocument()
    );
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

describe('Navigation', () => {
  it('navigiert zu /admin/system-alerts/stats beim Klick auf Trend-Analyse', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByRole('button', { name: /Trend-Analyse/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/system-alerts/stats');
  });
});
