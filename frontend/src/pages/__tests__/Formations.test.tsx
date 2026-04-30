import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Formations from '../Formations';

// ── Browser API shims ────────────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn(),
  })),
});

// ── MUI mocks ─────────────────────────────────────────────────────────────────
jest.mock('@mui/material', () => {
  const actual = jest.requireActual('@mui/material');
  return {
    ...actual,
    useTheme: () => ({
      palette: {
        primary: { main: '#018606', contrastText: '#fff' },
        text: { primary: '#000', secondary: '#666', disabled: '#999' },
        mode: 'light',
      },
      shadows: Array(25).fill('none'),
    }),
    Box:          (props: any) => <div data-testid={props['data-testid']}>{props.children}</div>,
    Typography:   (props: any) => <span data-testid={props['data-testid']}>{props.children}</span>,
    Button:       (props: any) => (
      <button
        data-testid={props['data-testid'] ?? 'button'}
        aria-label={props['aria-label']}
        onClick={props.onClick}
        disabled={props.disabled}
      >
        {props.children}
      </button>
    ),
    IconButton:   (props: any) => <button aria-label={props['aria-label']} onClick={props.onClick}>{props.children}</button>,
    Card:         (props: any) => <div>{props.children}</div>,
    CardActionArea:(props: any) => <div onClick={props.onClick}>{props.children}</div>,
    CardContent:  (props: any) => <div>{props.children}</div>,
    CardActions:  (props: any) => <div>{props.children}</div>,
    Chip:         (props: any) => <span>{props.label ?? props.children}</span>,
    Tooltip:      (props: any) => <span>{props.children}</span>,
    Divider:      () => <hr />,
    Stack:        (props: any) => <div>{props.children}</div>,
    Menu:         (props: any) => props.open ? <div>{props.children}</div> : null,
    MenuItem:     (props: any) => <option value={props.value}>{props.children}</option>,
    FormControl:  (props: any) => <div>{props.children}</div>,
    InputLabel:   (props: any) => <label>{props.children}</label>,
    Select:       (props: any) => (
      <select
        data-testid="formation-team-select"
        value={props.value ?? ''}
        onChange={props.onChange}
      >
        {props.children}
      </select>
    ),
  };
});

// ── Icon mocks ────────────────────────────────────────────────────────────────
jest.mock('@mui/icons-material/AddCircle',    () => () => <span>AddIcon</span>);
jest.mock('@mui/icons-material/MoreVert',     () => () => <span>MoreVertIcon</span>);
jest.mock('@mui/icons-material/Edit',         () => () => <span>EditIcon</span>);
jest.mock('@mui/icons-material/ContentCopy',  () => () => <span>CopyIcon</span>);
jest.mock('@mui/icons-material/Delete',       () => () => <span>DeleteIcon</span>);
jest.mock('@mui/icons-material/Sports',       () => () => <span>SportsIcon</span>);
jest.mock('@mui/icons-material/PresentToAll', () => () => <span>PresentIcon</span>);
jest.mock('@mui/icons-material/FilterList',   () => () => <span>FilterIcon</span>);

// ── Auth Context mock (wird pro Test überschrieben) ───────────────────────────
const mockUseAuth = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ── Modal mocks ───────────────────────────────────────────────────────────────
jest.mock('../../modals/FormationEditModal', () => (props: any) =>
  props.open ? <div data-testid="FormationEditModal">EditModal</div> : null
);
jest.mock('../../modals/FormationDeleteConfirmationModal', () => (props: any) =>
  props.open ? <div data-testid="FormationDeleteModal">DeleteModal</div> : null
);
jest.mock('../../modals/TacticsBoardModal', () => (props: any) =>
  props.open ? <div data-testid="TacticsBoardModal">TacticsModal</div> : null
);

// ── helpers mock ──────────────────────────────────────────────────────────────
jest.mock('../../modals/formation/helpers', () => ({
  getZoneColor: () => '#fff',
}));

// ── API mock ──────────────────────────────────────────────────────────────────
const mockApiJson = jest.fn();
jest.mock('../../utils/api', () => ({
  apiJson: (...args: any[]) => mockApiJson(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const TEAM_A = { id: 10, name: 'A-Jugend' };
const TEAM_B = { id: 20, name: 'B-Jugend' };

const makeFormation = (id: number, name: string) => ({
  id,
  name,
  formationType: { name: 'Fußball', cssClass: 'football', backgroundPath: 'pitch.png' },
  formationData: { code: '4-3-3', players: [], bench: [] },
});

const FORMATION_1 = makeFormation(1, 'Meine Formation');
const FORMATION_2 = makeFormation(2, 'Andere Formation');

// ── Setup / teardown ─────────────────────────────────────────────────────────
beforeEach(() => {
  mockApiJson.mockReset();
  mockUseAuth.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore?.();
  (console.warn as jest.Mock).mockRestore?.();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Rendert die Seite als normaler User (kein SUPERADMIN). */
async function renderAsNormalUser(formations = [FORMATION_1]) {
  mockUseAuth.mockReturnValue({ isSuperAdmin: false });
  mockApiJson.mockImplementation((url: string) => {
    if (url === '/formations') return Promise.resolve({ formations });
    if (url === '/formations/archived') return Promise.resolve({ formations: [] });
    return Promise.reject(new Error(`Unerwarteter API-Aufruf: ${url}`));
  });
  render(<Formations />);
  await waitFor(() => expect(screen.queryByText(/Lade Aufstellungen/i)).not.toBeInTheDocument());
}

/** Rendert die Seite als SUPERADMIN mit optionaler Teamliste. */
async function renderAsSuperAdmin(
  teams = [TEAM_A, TEAM_B],
  formations = [FORMATION_1],
) {
  mockUseAuth.mockReturnValue({ isSuperAdmin: true });
  mockApiJson.mockImplementation((url: string) => {
    if (url === '/formations/teams') return Promise.resolve({ teams });
    if (url.startsWith('/formations')) return Promise.resolve({ formations });
    return Promise.reject(new Error(`Unerwarteter API-Aufruf: ${url}`));
  });
  render(<Formations />);
  await waitFor(() => expect(screen.queryByText(/Lade Aufstellungen/i)).not.toBeInTheDocument());
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('Formations — normaler User', () => {
  test('lädt Formationen via GET /formations beim Start', async () => {
    await renderAsNormalUser();
    expect(mockApiJson).toHaveBeenCalledWith('/formations');
  });

  test('zeigt Formations-Karten wenn Daten vorhanden', async () => {
    await renderAsNormalUser([FORMATION_1, FORMATION_2]);
    expect(screen.getByText('Meine Formation')).toBeInTheDocument();
    expect(screen.getByText('Andere Formation')).toBeInTheDocument();
  });

  test('zeigt Leer-Zustand wenn keine Formationen vorhanden', async () => {
    await renderAsNormalUser([]);
    expect(screen.getByText(/Noch keine Aufstellungen vorhanden/i)).toBeInTheDocument();
  });

  test('zeigt Anzahl der Formationen im Untertitel', async () => {
    await renderAsNormalUser([FORMATION_1, FORMATION_2]);
    expect(screen.getByText(/2 Aufstellungen aktiv/i)).toBeInTheDocument();
  });

  test('zeigt kein Team-Dropdown für normalen User', async () => {
    await renderAsNormalUser();
    expect(screen.queryByTestId('formation-team-select')).not.toBeInTheDocument();
  });

  test('ruft /formations/teams NICHT für normalen User auf', async () => {
    await renderAsNormalUser();
    const teamCalls = mockApiJson.mock.calls.filter(([url]: [string]) => url === '/formations/teams');
    expect(teamCalls).toHaveLength(0);
  });

  test('öffnet Edit-Modal wenn "Neue Aufstellung" geklickt wird', async () => {
    await renderAsNormalUser();
    const buttons = screen.getAllByRole('button', { name: /Neue Aufstellung/i });
    fireEvent.click(buttons[0]);
    expect(screen.getByTestId('FormationEditModal')).toBeInTheDocument();
  });
});

describe('Formations — SUPERADMIN Team-Dropdown', () => {
  test('lädt /formations/teams beim Start für SUPERADMIN', async () => {
    await renderAsSuperAdmin();
    expect(mockApiJson).toHaveBeenCalledWith('/formations/teams');
  });

  test('zeigt Team-Dropdown wenn SUPERADMIN und Teams vorhanden', async () => {
    await renderAsSuperAdmin([TEAM_A, TEAM_B]);
    await waitFor(() =>
      expect(screen.getByTestId('formation-team-select')).toBeInTheDocument()
    );
  });

  test('zeigt kein Team-Dropdown wenn Teams-Liste leer ist', async () => {
    await renderAsSuperAdmin([]);
    expect(screen.queryByTestId('formation-team-select')).not.toBeInTheDocument();
  });

  test('Team-Dropdown enthält alle Teams aus der API', async () => {
    await renderAsSuperAdmin([TEAM_A, TEAM_B]);
    await waitFor(() => {
      expect(screen.getByText('A-Jugend')).toBeInTheDocument();
      expect(screen.getByText('B-Jugend')).toBeInTheDocument();
    });
  });

  test('Auswahl eines Teams lädt /formations?teamId=<id>', async () => {
    await renderAsSuperAdmin([TEAM_A, TEAM_B]);
    await waitFor(() => screen.getByTestId('formation-team-select'));

    mockApiJson.mockClear();
    mockApiJson.mockResolvedValue({ formations: [FORMATION_2] });

    const select = screen.getByTestId('formation-team-select');
    fireEvent.change(select, { target: { value: String(TEAM_A.id) } });

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(`/formations?teamId=${TEAM_A.id}`);
    });
  });

  test('Auswahl eines anderen Teams neu lädt korrekte URL', async () => {
    await renderAsSuperAdmin([TEAM_A, TEAM_B]);
    await waitFor(() => screen.getByTestId('formation-team-select'));

    mockApiJson.mockClear();
    mockApiJson.mockResolvedValue({ formations: [] });

    const select = screen.getByTestId('formation-team-select');
    fireEvent.change(select, { target: { value: String(TEAM_B.id) } });

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith(`/formations?teamId=${TEAM_B.id}`);
    });
  });

  test('Auswahl "Alle meinen Teams" (leerer Wert) lädt /formations ohne teamId', async () => {
    await renderAsSuperAdmin([TEAM_A, TEAM_B]);
    await waitFor(() => screen.getByTestId('formation-team-select'));

    // Erst ein Team wählen, dann zurück auf "alle"
    const select = screen.getByTestId('formation-team-select');
    mockApiJson.mockClear();
    mockApiJson.mockResolvedValue({ formations: [FORMATION_1] });

    fireEvent.change(select, { target: { value: String(TEAM_A.id) } });
    await waitFor(() => mockApiJson.mock.calls.length > 0);

    mockApiJson.mockClear();
    mockApiJson.mockResolvedValue({ formations: [FORMATION_1, FORMATION_2] });

    fireEvent.change(select, { target: { value: '' } });

    await waitFor(() => {
      expect(mockApiJson).toHaveBeenCalledWith('/formations');
    });
  });

  test('nach Teamwechsel werden neue Formationen angezeigt', async () => {
    await renderAsSuperAdmin([TEAM_A, TEAM_B], [FORMATION_1]);

    const select = await screen.findByTestId('formation-team-select');

    mockApiJson.mockImplementation((url: string) => {
      if (url === `/formations?teamId=${TEAM_B.id}`) {
        return Promise.resolve({ formations: [FORMATION_2] });
      }
      return Promise.resolve({ formations: [] });
    });

    fireEvent.change(select, { target: { value: String(TEAM_B.id) } });

    await waitFor(() => {
      expect(screen.getByText('Andere Formation')).toBeInTheDocument();
    });
  });

  test('/formations/teams-Fehler führt nicht zum Absturz', async () => {
    mockUseAuth.mockReturnValue({ isSuperAdmin: true });
    mockApiJson.mockImplementation((url: string) => {
      if (url === '/formations/teams') return Promise.reject(new Error('Netzwerkfehler'));
      if (url.startsWith('/formations')) return Promise.resolve({ formations: [] });
      return Promise.reject(new Error('Unbekannte URL'));
    });

    render(<Formations />);
    await waitFor(() =>
      expect(screen.queryByText(/Lade Aufstellungen/i)).not.toBeInTheDocument()
    );

    // Kein Dropdown, keine Exception — Seite bleibt stabil
    expect(screen.queryByTestId('formation-team-select')).not.toBeInTheDocument();
    expect(screen.getByText(/Noch keine Aufstellungen vorhanden/i)).toBeInTheDocument();
  });
});

describe('Formations — Loading-State', () => {
  test('zeigt Ladeindikator während Formationen geladen werden', async () => {
    mockUseAuth.mockReturnValue({ isSuperAdmin: false });
    let resolve!: (v: any) => void;
    mockApiJson.mockReturnValue(new Promise(r => { resolve = r; }));

    render(<Formations />);
    expect(screen.getByText(/Lade Aufstellungen/i)).toBeInTheDocument();

    resolve({ formations: [] });
    await waitFor(() =>
      expect(screen.queryByText(/Lade Aufstellungen/i)).not.toBeInTheDocument()
    );
  });
});
