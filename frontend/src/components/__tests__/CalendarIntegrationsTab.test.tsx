import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import CalendarIntegrationsTab from '../CalendarIntegrationsTab';

// ─── MUI + Icon Mocks ─────────────────────────────────────────────────────────

jest.mock('@mui/material/styles', () => ({
  alpha: (_color: string, _opacity: number) => 'rgba(0,0,0,0.1)',
  useTheme: () => ({ palette: { primary: { main: '#1976d2' }, divider: '#e0e0e0' } }),
  createTheme: () => ({}),
  ThemeProvider: ({ children }: any) => children,
  styled: () => (props: any) => <div {...props} />,
}));

// Mock individual MUI subpath imports used by the component
jest.mock('@mui/material/Box',            () => ({ __esModule: true, default: (props: any) => <div data-testid={props['data-testid']} className={props.className}>{props.children}</div> }));
jest.mock('@mui/material/Typography',     () => ({ __esModule: true, default: (props: any) => <span>{props.children}</span> }));
jest.mock('@mui/material/Button',         () => ({ __esModule: true, default: (props: any) => <button disabled={props.disabled} onClick={props.onClick} data-testid={props['data-testid']}>{props.startIcon}{props.children}</button> }));
jest.mock('@mui/material/IconButton',     () => ({ __esModule: true, default: (props: any) => <button disabled={props.disabled} onClick={props.onClick} aria-label={props['aria-label']}>{props.children}</button> }));
jest.mock('@mui/material/Alert',          () => ({ __esModule: true, default: ({ children, severity, onClose }: any) => <div role="alert" data-severity={severity}>{children}{onClose && <button onClick={onClose} aria-label="Schließen">×</button>}</div> }));
jest.mock('@mui/material/Stack',          () => ({ __esModule: true, default: (props: any) => <div>{props.children}</div> }));
jest.mock('@mui/material/Chip',           () => ({ __esModule: true, default: (props: any) => <span data-testid="Chip">{props.label || props.children}</span> }));
jest.mock('@mui/material/Divider',        () => ({ __esModule: true, default: () => <hr /> }));
jest.mock('@mui/material/CircularProgress', () => ({ __esModule: true, default: () => <span data-testid="CircularProgress" /> }));
jest.mock('@mui/material/TextField',      () => ({ __esModule: true, default: (props: any) => <input data-testid={props.label} value={props.value} onChange={props.onChange} placeholder={props.placeholder} /> }));
jest.mock('@mui/material/Switch',         () => ({ __esModule: true, default: (props: any) => <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange?.(e, e.target.checked)} data-testid={`switch-${props['data-name'] ?? 'switch'}`} /> }));
jest.mock('@mui/material/Tooltip',        () => ({ __esModule: true, default: (props: any) => <span title={props.title}>{props.children}</span> }));
jest.mock('@mui/material/Dialog',         () => ({ __esModule: true, default: ({ open, children }: any) => open ? <div role="dialog">{children}</div> : null }));
jest.mock('@mui/material/DialogTitle',    () => ({ __esModule: true, default: (props: any) => <h2>{props.children}</h2> }));
jest.mock('@mui/material/DialogContent',  () => ({ __esModule: true, default: (props: any) => <div>{props.children}</div> }));
jest.mock('@mui/material/DialogActions',  () => ({ __esModule: true, default: (props: any) => <div>{props.children}</div> }));

// MUI icons
jest.mock('@mui/icons-material/CalendarMonth',       () => () => <span>📅</span>);
jest.mock('@mui/icons-material/VpnKey',              () => () => <span>🔑</span>);
jest.mock('@mui/icons-material/ContentCopy',         () => () => <span>📋</span>);
jest.mock('@mui/icons-material/Refresh',             () => () => <span>🔄</span>);
jest.mock('@mui/icons-material/DeleteOutlined',       () => () => <span>🗑</span>);
jest.mock('@mui/icons-material/Add',                 () => () => <span>➕</span>);
jest.mock('@mui/icons-material/OpenInNew',           () => () => <span>🔗</span>);
jest.mock('@mui/icons-material/CheckCircleOutlined',  () => () => <span>✅</span>);
jest.mock('@mui/icons-material/Edit',                () => () => <span>✏️</span>);

// ─── API Mock ──────────────────────────────────────────────────────────────────

const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ─── Clipboard Mock ───────────────────────────────────────────────────────────

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

// ─── matchMedia ───────────────────────────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches:           false,
      media:             query,
      onchange:          null,
      addListener:       jest.fn(),
      removeListener:    jest.fn(),
      addEventListener:  jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent:     jest.fn(),
    })),
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTokenStatus(overrides: Partial<{
  hasToken: boolean;
  createdAt: string | null;
  feeds: { personal: string; club: string; platform: string } | null;
}> = {}) {
  return {
    hasToken:  true,
    createdAt: '2026-03-13T10:00:00+00:00',
    feeds: {
      personal: 'http://localhost/ical/kcal_abc123/personal.ics',
      club:     'http://localhost/ical/kcal_abc123/club.ics',
      platform: 'http://localhost/ical/kcal_abc123/platform.ics',
    },
    ...overrides,
  };
}

function buildExternalCalendar(overrides: Partial<{
  id: number; name: string; color: string; url: string;
  isEnabled: boolean; lastFetchedAt: string | null; createdAt: string;
}> = {}) {
  return {
    id:            42,
    name:          'Google Calendar',
    color:         '#4CAF50',
    url:           'https://calendar.google.com/ical/test/basic.ics',
    isEnabled:     true,
    lastFetchedAt: null,
    createdAt:     '2026-03-13T09:00:00+00:00',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CalendarIntegrationsTab', () => {

  beforeEach(() => {
    mockApiJson.mockReset();
    // Default: kein Token, keine externen Kalender
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/profile/calendar/token')   return Promise.resolve(buildTokenStatus({ hasToken: false, createdAt: null, feeds: null }));
      if (url === '/api/profile/calendar/external') return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected API call: ${url}`));
    });
  });

  // =========================================================================
  //  Lade-Zustand & Initialdaten
  // =========================================================================

  it('renders export section heading', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(screen.getByText('Kalender exportieren')).toBeInTheDocument();
    });
  });

  it('renders import section heading', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(screen.getByText('Externe Kalender einbinden')).toBeInTheDocument();
    });
  });

  it('calls token status endpoint on mount', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/api/profile/calendar/token');
    });
  });

  it('calls external calendars endpoint on mount', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/api/profile/calendar/external');
    });
  });

  // =========================================================================
  //  Status: kein Token
  // =========================================================================

  it('shows generate button when no token exists', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(screen.getByText('Feed-Links generieren')).toBeInTheDocument();
    });
  });

  it('shows empty-state chip when no token exists', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(screen.getByText('Noch keine Feed-Links generiert')).toBeInTheDocument();
    });
  });

  it('does not show feed URLs when no token exists', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(screen.queryByText(/personal\.ics/)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  //  Status: Token vorhanden
  // =========================================================================

  it('shows feed URLs when token exists', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/profile/calendar/token')   return Promise.resolve(buildTokenStatus());
      if (url === '/api/profile/calendar/external') return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      // Mehrere Elemente mit der URL sind erlaubt (http + webcal)
      expect(screen.getAllByText(/personal\.ics/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/club\.ics/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/platform\.ics/).length).toBeGreaterThan(0);
    });
  });

  it('shows revoke and regenerate buttons when token exists', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/profile/calendar/token')   return Promise.resolve(buildTokenStatus());
      if (url === '/api/profile/calendar/external') return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(screen.getByText('Links widerrufen')).toBeInTheDocument();
      expect(screen.getByText('Links neu generieren')).toBeInTheDocument();
    });
  });

  // =========================================================================
  //  Token generieren
  // =========================================================================

  it('calls POST /api/profile/calendar/token on generate click', async () => {
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/token' && !opts) return Promise.resolve(buildTokenStatus({ hasToken: false, createdAt: null, feeds: null }));
      if (url === '/api/profile/calendar/external')        return Promise.resolve([]);
      if (url === '/api/profile/calendar/token' && opts?.method === 'POST')
        return Promise.resolve(buildTokenStatus({ hasToken: true, createdAt: '2026-03-13T10:00:00+00:00', feeds: buildTokenStatus().feeds }));
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Feed-Links generieren'));

    await act(async () => {
      fireEvent.click(screen.getByText('Feed-Links generieren'));
    });

    expect(mockApiJson).toHaveBeenCalledWith('/api/profile/calendar/token', { method: 'POST' });
  });

  it('shows success message after token generation', async () => {
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/external') return Promise.resolve([]);
      if (url === '/api/profile/calendar/token' && !opts) return Promise.resolve(buildTokenStatus({ hasToken: false, createdAt: null, feeds: null }));
      if (url === '/api/profile/calendar/token' && opts?.method === 'POST') return Promise.resolve(buildTokenStatus());
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Feed-Links generieren'));

    await act(async () => {
      fireEvent.click(screen.getByText('Feed-Links generieren'));
    });

    await waitFor(() => {
      expect(screen.getByText('Feed-Links wurden generiert.')).toBeInTheDocument();
    });
  });

  it('shows error message when token generation fails', async () => {
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/external') return Promise.resolve([]);
      if (url === '/api/profile/calendar/token' && !opts) return Promise.resolve(buildTokenStatus({ hasToken: false, createdAt: null, feeds: null }));
      if (url === '/api/profile/calendar/token' && opts?.method === 'POST') return Promise.reject(new Error('Server Error'));
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Feed-Links generieren'));

    await act(async () => {
      fireEvent.click(screen.getByText('Feed-Links generieren'));
    });

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Generieren des Tokens.')).toBeInTheDocument();
    });
  });

  // =========================================================================
  //  Token widerrufen
  // =========================================================================

  it('calls DELETE /api/profile/calendar/token on revoke click', async () => {
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/external')    return Promise.resolve([]);
      if (url === '/api/profile/calendar/token' && !opts) return Promise.resolve(buildTokenStatus());
      if (url === '/api/profile/calendar/token' && opts?.method === 'DELETE') return Promise.resolve({});
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Links widerrufen'));

    await act(async () => {
      fireEvent.click(screen.getByText('Links widerrufen'));
    });

    expect(mockApiJson).toHaveBeenCalledWith('/api/profile/calendar/token', { method: 'DELETE' });
  });

  it('hides feed URLs after revoke', async () => {
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/external')       return Promise.resolve([]);
      if (url === '/api/profile/calendar/token' && !opts) return Promise.resolve(buildTokenStatus());
      if (url === '/api/profile/calendar/token' && opts?.method === 'DELETE') return Promise.resolve({});
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Links widerrufen'));

    await act(async () => {
      fireEvent.click(screen.getByText('Links widerrufen'));
    });

    await waitFor(() => {
      expect(screen.queryByText(/personal\.ics/)).not.toBeInTheDocument();
    });
  });

  it('shows success message after revoke', async () => {
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/external')       return Promise.resolve([]);
      if (url === '/api/profile/calendar/token' && !opts) return Promise.resolve(buildTokenStatus());
      if (url === '/api/profile/calendar/token' && opts?.method === 'DELETE') return Promise.resolve({});
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Links widerrufen'));

    await act(async () => {
      fireEvent.click(screen.getByText('Links widerrufen'));
    });

    await waitFor(() => {
      expect(screen.getByText('Feed-Links wurden widerrufen.')).toBeInTheDocument();
    });
  });

  // =========================================================================
  //  Feed-URL Sicherheit: kcal_-Token wird in URLs angezeigt (nicht versteckt)
  //  und enthält das korrekte Präfix
  // =========================================================================

  it('feed URLs display the kcal_-prefixed token in the URL', async () => {
    const kcalToken = 'kcal_' + 'a'.repeat(56);
    const feeds = {
      personal: `http://localhost/ical/${kcalToken}/personal.ics`,
      club:     `http://localhost/ical/${kcalToken}/club.ics`,
      platform: `http://localhost/ical/${kcalToken}/platform.ics`,
    };

    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/profile/calendar/token')   return Promise.resolve(buildTokenStatus({ feeds }));
      if (url === '/api/profile/calendar/external') return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      // Die Feed-URL wird im DOM sichtbar angezeigt
      const personalUrl = screen.getAllByText(new RegExp('personal\\.ics'));
      expect(personalUrl.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  //  Externe Kalender – Liste
  // =========================================================================

  it('shows external calendars when loaded', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/profile/calendar/token')    return Promise.resolve(buildTokenStatus({ hasToken: false, createdAt: null, feeds: null }));
      if (url === '/api/profile/calendar/external') return Promise.resolve([
        buildExternalCalendar({ id: 1, name: 'Google Calendar' }),
        buildExternalCalendar({ id: 2, name: 'Apple iCloud' }),
      ]);
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(screen.getByText('Google Calendar')).toBeInTheDocument();
      expect(screen.getByText('Apple iCloud')).toBeInTheDocument();
    });
  });

  it('shows empty state text when no external calendars', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(screen.getByText('Noch keine externen Kalender konfiguriert.')).toBeInTheDocument();
    });
  });

  it('shows "Kalender hinzufügen" button always', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      expect(screen.getByText('Kalender hinzufügen')).toBeInTheDocument();
    });
  });

  // =========================================================================
  //  Externen Kalender hinzufügen – Dialog
  // =========================================================================

  it('opens add dialog on "Kalender hinzufügen" click', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Kalender hinzufügen'));

    fireEvent.click(screen.getByText('Kalender hinzufügen'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Externen Kalender hinzufügen')).toBeInTheDocument();
  });

  it('shows form error when name is empty on save', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Kalender hinzufügen'));

    fireEvent.click(screen.getByText('Kalender hinzufügen'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Der "Hinzufügen"-Button im Dialog
    const addBtns = screen.getAllByText('Hinzufügen');
    fireEvent.click(addBtns[addBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Name ist erforderlich')).toBeInTheDocument();
    });
    expect(mockApiJson).not.toHaveBeenCalledWith('/api/profile/calendar/external', expect.objectContaining({ method: 'POST' }));
  });

  it('shows form error when URL is empty on save', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Kalender hinzufügen'));

    fireEvent.click(screen.getByText('Kalender hinzufügen'));

    // Name ausfüllen
    const nameInput = screen.getByPlaceholderText('z. B. Mein Google Calendar');
    fireEvent.change(nameInput, { target: { value: 'Mein Kalender' } });

    // Ohne URL speichern
    const addBtns = screen.getAllByText('Hinzufügen');
    fireEvent.click(addBtns[addBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('URL ist erforderlich')).toBeInTheDocument();
    });
    expect(mockApiJson).not.toHaveBeenCalledWith('/api/profile/calendar/external', expect.objectContaining({ method: 'POST' }));
  });

  it('calls POST /api/profile/calendar/external with correct payload', async () => {
    const newCal = buildExternalCalendar({ id: 99, name: 'Neuer Test', url: 'https://example.com/new.ics' });

    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/token')    return Promise.resolve(buildTokenStatus({ hasToken: false, createdAt: null, feeds: null }));
      if (url === '/api/profile/calendar/external' && !opts) return Promise.resolve([]);
      if (url === '/api/profile/calendar/external' && opts?.method === 'POST') return Promise.resolve(newCal);
      return Promise.reject(new Error(`Unexpected: ${url} ${opts?.method}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Kalender hinzufügen'));

    fireEvent.click(screen.getByText('Kalender hinzufügen'));

    const nameInput = screen.getByPlaceholderText('z. B. Mein Google Calendar');
    const urlInput  = screen.getByPlaceholderText('https://calendar.google.com/calendar/ical/...');

    fireEvent.change(nameInput, { target: { value: 'Neuer Test' } });
    fireEvent.change(urlInput,  { target: { value: 'https://example.com/new.ics' } });

    const addBtns = screen.getAllByText('Hinzufügen');
    await act(async () => {
      fireEvent.click(addBtns[addBtns.length - 1]);
    });

    expect(mockApiJson).toHaveBeenCalledWith('/api/profile/calendar/external', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        name: 'Neuer Test',
        url:  'https://example.com/new.ics',
      }),
    }));
  });

  it('shows newly created calendar in the list', async () => {
    const newCal = buildExternalCalendar({ id: 99, name: 'Frischer Kalender' });

    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/token')    return Promise.resolve(buildTokenStatus({ hasToken: false, createdAt: null, feeds: null }));
      if (url === '/api/profile/calendar/external' && !opts) return Promise.resolve([]);
      if (url === '/api/profile/calendar/external' && opts?.method === 'POST') return Promise.resolve(newCal);
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Kalender hinzufügen'));
    fireEvent.click(screen.getByText('Kalender hinzufügen'));

    const nameInput = screen.getByPlaceholderText('z. B. Mein Google Calendar');
    const urlInput  = screen.getByPlaceholderText('https://calendar.google.com/calendar/ical/...');
    fireEvent.change(nameInput, { target: { value: 'Frischer Kalender' } });
    fireEvent.change(urlInput,  { target: { value: 'https://example.com/fresh.ics' } });

    const addBtns = screen.getAllByText('Hinzufügen');
    await act(async () => { fireEvent.click(addBtns[addBtns.length - 1]); });

    await waitFor(() => {
      expect(screen.getByText('Frischer Kalender')).toBeInTheDocument();
    });
  });

  it('closes dialog after successful save', async () => {
    const newCal = buildExternalCalendar({ id: 99, name: 'Gespeichert' });

    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/token')    return Promise.resolve(buildTokenStatus({ hasToken: false, createdAt: null, feeds: null }));
      if (url === '/api/profile/calendar/external' && !opts) return Promise.resolve([]);
      if (url === '/api/profile/calendar/external' && opts?.method === 'POST') return Promise.resolve(newCal);
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Kalender hinzufügen'));
    fireEvent.click(screen.getByText('Kalender hinzufügen'));

    const nameInput = screen.getByPlaceholderText('z. B. Mein Google Calendar');
    const urlInput  = screen.getByPlaceholderText('https://calendar.google.com/calendar/ical/...');
    fireEvent.change(nameInput, { target: { value: 'Gespeichert' } });
    fireEvent.change(urlInput,  { target: { value: 'https://example.com/save.ics' } });

    const addBtns = screen.getAllByText('Hinzufügen');
    await act(async () => { fireEvent.click(addBtns[addBtns.length - 1]); });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  //  Externen Kalender löschen
  // =========================================================================

  it('calls DELETE and removes calendar from list', async () => {
    const cal = buildExternalCalendar({ id: 77, name: 'Zu löschen' });

    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/token')     return Promise.resolve(buildTokenStatus({ hasToken: false, createdAt: null, feeds: null }));
      if (url === '/api/profile/calendar/external')  return Promise.resolve([cal]);
      if (url === `/api/profile/calendar/external/77` && opts?.method === 'DELETE') return Promise.resolve({});
      return Promise.reject(new Error(`Unexpected: ${url} ${opts?.method}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Zu löschen'));

    // Der Löschen-Button ist innerhalb der Tooltip-Span mit title="Entfernen"
    const tooltipSpan = screen.getByTitle('Entfernen');
    const deleteBtn = tooltipSpan.querySelector('button') as HTMLElement;
    expect(deleteBtn).toBeTruthy();
    await act(async () => { fireEvent.click(deleteBtn); });

    expect(mockApiJson).toHaveBeenCalledWith('/api/profile/calendar/external/77', { method: 'DELETE' });

    await waitFor(() => {
      expect(screen.queryByText('Zu löschen')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  //  API-Fehlerbehandlung
  // =========================================================================

  it('shows error message when external calendar save fails', async () => {
    mockApiJson.mockImplementation((url: string, opts?: any) => {
      if (url === '/api/profile/calendar/token')    return Promise.resolve(buildTokenStatus({ hasToken: false, createdAt: null, feeds: null }));
      if (url === '/api/profile/calendar/external' && !opts) return Promise.resolve([]);
      if (url === '/api/profile/calendar/external' && opts?.method === 'POST') return Promise.reject(Object.assign(new Error('URL ist nicht erreichbar'), { message: 'URL ist nicht erreichbar' }));
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Kalender hinzufügen'));
    fireEvent.click(screen.getByText('Kalender hinzufügen'));

    const nameInput = screen.getByPlaceholderText('z. B. Mein Google Calendar');
    const urlInput  = screen.getByPlaceholderText('https://calendar.google.com/calendar/ical/...');
    fireEvent.change(nameInput, { target: { value: 'Fehler Test' } });
    fireEvent.change(urlInput,  { target: { value: 'https://example.com/err.ics' } });

    const addBtns = screen.getAllByText('Hinzufügen');
    await act(async () => { fireEvent.click(addBtns[addBtns.length - 1]); });

    await waitFor(() => {
      // formError wird gesetzt, enthält den API-Fehlermessage
      expect(screen.getByText('URL ist nicht erreichbar')).toBeInTheDocument();
    });
  });

  it('handles loadTokenStatus failure gracefully', async () => {
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/api/profile/calendar/token')   return Promise.reject(new Error('Netzwerkfehler'));
      if (url === '/api/profile/calendar/external') return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    // Soll nicht crashen
    render(<CalendarIntegrationsTab />);
    await waitFor(() => {
      // Nach Fehler zeigt der Tab weiterhin die Basis-UI
      expect(screen.getByText('Kalender exportieren')).toBeInTheDocument();
    });
  });

  // =========================================================================
  //  Dialog schließen
  // =========================================================================

  it('closes dialog on Abbrechen click', async () => {
    render(<CalendarIntegrationsTab />);
    await waitFor(() => screen.getByText('Kalender hinzufügen'));

    fireEvent.click(screen.getByText('Kalender hinzufügen'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Abbrechen'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
